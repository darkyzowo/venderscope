import os
import uuid
from urllib.parse import urlparse
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Cookie, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
import jwt
from jwt.exceptions import PyJWTError as JWTError
from database import get_db
from datetime import datetime, timezone
from models import User, RevokedToken
from limiter import limiter
from services.alerts import send_welcome_email
from services.audit import audit
from services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    REFRESH_TOKEN_EXPIRE_DAYS,
    JWT_SECRET,
    ALGORITHM,
)

router = APIRouter()

# Detect production (Render sets RENDER=true)
_IS_PROD = bool(os.getenv("RENDER"))


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters")
        if len(v) > 128:
            raise ValueError("Password must be under 128 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_max_length(cls, v):
        if len(v) > 128:
            raise ValueError("Password too long")
        return v


class DeleteAccountRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_max_length(cls, v: str) -> str:
        if len(v) > 128:
            raise ValueError("Password too long")
        return v


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="vs_refresh",
        value=token,
        httponly=True,
        secure=_IS_PROD,
        samesite="none" if _IS_PROD else "lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="vs_refresh",
        path="/api/auth",
        samesite="none" if _IS_PROD else "lax",
        secure=_IS_PROD,
    )


def _verify_origin(request: Request) -> None:
    """
    Defence-in-depth CSRF protection for endpoints that consume the httpOnly refresh cookie.

    Primary protection: all JSON endpoints trigger a CORS preflight which blocks
    cross-origin requests for unlisted origins. This is the second layer — a
    server-side check that covers edge cases where preflight is bypassed (e.g.
    same-origin redirects, non-standard clients, future endpoint changes).

    Skipped when FRONTEND_URL is not set (local dev without env var).
    """
    allowed = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not allowed:
        return
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if not origin:
        return
    parsed_allowed = urlparse(allowed)
    parsed_origin  = urlparse(origin)
    if not (parsed_origin.scheme == parsed_allowed.scheme and
            parsed_origin.netloc == parsed_allowed.netloc):
        raise HTTPException(status_code=403, detail="Origin not allowed")


@router.post("/register")
@limiter.limit("3/hour")
def register(request: Request, background_tasks: BackgroundTasks, payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(
        id=str(uuid.uuid4()),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    audit(db, "register.success", request, user_id=user.id)
    background_tasks.add_task(send_welcome_email, user.email)
    return {"message": "Account created successfully"}


@router.post("/login")
@limiter.limit("5/minute")
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Always run bcrypt to prevent timing-based user enumeration (CRIT-01)
    dummy_hash = "$2b$12$LJ3m4ys3Lk0TDBGfGgsZKeDUxPlvMNnbBOHJbEHYsV3eIEfpyQ1SK"
    pw_hash = user.password_hash if user else dummy_hash
    password_ok = verify_password(payload.password, pw_hash)
    if not (user is not None and password_ok):
        audit(db, "login.failed", request, detail=f"email={payload.email.lower()}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    audit(db, "login.success", request, user_id=user.id)
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh")
@limiter.limit("10/minute")
def refresh_token_endpoint(
    request: Request,
    response: Response,
    vs_refresh: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    _verify_origin(request)
    if not vs_refresh:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(vs_refresh, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id: str = payload.get("sub")
        jti: str     = payload.get("jti")
        if not user_id or not jti:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Reject if this token was already revoked (logout or prior rotation)
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Revoke the old JTI immediately — each refresh token is single-use
    exp = payload.get("exp")
    if exp:
        db.add(RevokedToken(
            jti=jti,
            expires_at=datetime.fromtimestamp(exp, tz=timezone.utc),
        ))
        db.commit()

    new_access_token  = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, new_refresh_token)
    return {"access_token": new_access_token}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    vs_refresh: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    _verify_origin(request)
    # Blacklist the refresh token's JTI so it can't be reused after logout
    if vs_refresh:
        try:
            payload = jwt.decode(vs_refresh, JWT_SECRET, algorithms=[ALGORITHM])
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                if expires_at > datetime.now(timezone.utc):
                    db.add(RevokedToken(jti=jti, expires_at=expires_at))
                    db.commit()
        except JWTError:
            pass  # Malformed or already-expired token — nothing to revoke
    # Determine user_id for the audit log (best-effort — token may already be expired)
    _uid = None
    if vs_refresh:
        try:
            _uid = jwt.decode(vs_refresh, JWT_SECRET, algorithms=[ALGORITHM]).get("sub")
        except JWTError:
            pass
    audit(db, "logout", request, user_id=_uid)
    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email}


@router.delete("/account")
@limiter.limit("3/hour")
def delete_account(
    request: Request,
    response: Response,
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_origin(request)
    # Re-verify password before permanent, irreversible account deletion.
    # Protects against an attacker who briefly obtains a valid 15-min access token
    # (e.g. via XSS, shared device, shoulder surf) silently wiping the account.
    if not verify_password(payload.password, current_user.password_hash):
        audit(db, "account.delete.failed", request, user_id=current_user.id)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user_id = current_user.id
    db.delete(current_user)
    db.commit()
    audit(db, "account.deleted", request, user_id=user_id)
    _clear_refresh_cookie(response)
    return {"message": "Account deleted"}
