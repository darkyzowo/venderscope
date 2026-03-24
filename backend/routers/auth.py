import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Cookie, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from jose import JWTError, jwt
from database import get_db
from models import User
from limiter import limiter
from services.alerts import send_welcome_email
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
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be under 128 characters")
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


@router.post("/register")
@limiter.limit("3/hour")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    # Don't reveal whether email already exists — prevents account enumeration
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Registration failed. Please try again.")
    user = User(
        id=str(uuid.uuid4()),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    # Fire-and-forget — don't block registration if email delivery fails
    try:
        send_welcome_email(user.email)
    except Exception as e:
        print(f"[Auth] Welcome email failed: {e}")
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
        raise HTTPException(status_code=401, detail="Invalid credentials")

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
    if not vs_refresh:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(vs_refresh, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    new_access_token = create_access_token(user.id)
    # Rotate refresh token on each use — limits stolen token window
    new_refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, new_refresh_token)
    return {"access_token": new_access_token}


@router.post("/logout")
def logout(response: Response):
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete the authenticated user's account and all associated data."""
    db.delete(current_user)
    db.commit()
    _clear_refresh_cookie(response)
    return {"message": "Account deleted"}
