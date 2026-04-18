import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from config import get_frontend_origins, is_production, validate_frontend_config
from database import engine, Base, _is_sqlite
import models
from limiter import limiter
from routers import vendors, intelligence, export, quota, auth
from routers.dashboard import router as dashboard_router
from routers.guest import router as guest_router
from routers.acceptances import router as acceptances_router
from scheduler import start_scheduler

# Debug prints removed — CRIT-02: DATABASE_URL may contain credentials

Base.metadata.create_all(bind=engine)

# Column-level migrations — SQLite only (PostgreSQL uses create_all on a fresh DB)
if _is_sqlite:
    with engine.connect() as _conn:
        _vendor_cols = {row[1] for row in _conn.execute(text("PRAGMA table_info(vendors)")).fetchall()}
        for _col, _ddl in [
            ("description",      "ALTER TABLE vendors ADD COLUMN description TEXT"),
            ("auth_method",      "ALTER TABLE vendors ADD COLUMN auth_method VARCHAR"),
            ("two_factor",       "ALTER TABLE vendors ADD COLUMN two_factor VARCHAR"),
            ("user_id",          "ALTER TABLE vendors ADD COLUMN user_id VARCHAR(36)"),
            ("data_sensitivity",     "ALTER TABLE vendors ADD COLUMN data_sensitivity VARCHAR(20) DEFAULT 'standard'"),
            ("review_interval_days", "ALTER TABLE vendors ADD COLUMN review_interval_days INTEGER"),
            ("last_reviewed_at",     "ALTER TABLE vendors ADD COLUMN last_reviewed_at TIMESTAMP"),
        ]:
            if _col not in _vendor_cols:
                _conn.execute(text(_ddl))
                print(f"[Migration] Added column: {_col}")
        _conn.commit()

# Column-level migration for PostgreSQL (Neon) — create_all won't add columns to existing tables
if not _is_sqlite:
    with engine.connect() as _conn:
        _conn.execute(text("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS data_sensitivity VARCHAR(20) DEFAULT 'standard'"))
        _conn.execute(text("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS review_interval_days INTEGER"))
        _conn.execute(text("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP"))
        _conn.commit()

# ── Security headers middleware ─────────────────────────────────────────────
_IS_PROD = is_production()

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if _IS_PROD:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_frontend_config()
    start_scheduler()
    yield

app = FastAPI(
    title="VenderScope API",
    description="Continuous passive vendor risk intelligence platform",
    version="3.5.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_frontend_origins()),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Auth routes — rate limits applied inline with @limiter.limit
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(vendors.router,     prefix="/api/vendors",     tags=["Vendors"])
app.include_router(intelligence.router,prefix="/api/intelligence",tags=["Intelligence"])
app.include_router(export.router,      prefix="/api/export",      tags=["Export"])
app.include_router(quota.router,       prefix="/api/quota",       tags=["Quota"])
app.include_router(dashboard_router,   prefix="/api/dashboard",   tags=["dashboard"])
app.include_router(guest_router,       prefix="/api/guest",        tags=["guest"])
app.include_router(acceptances_router, prefix="/api/vendors",      tags=["Acceptances"])


@app.get("/")
def root():
    return {"status": "VenderScope is running 🚀"}


# ── Generic exception handler — prevents stack traces leaking to clients ────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()  # Still logged server-side for debugging
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
