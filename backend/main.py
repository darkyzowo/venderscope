from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from database import engine, Base
import models
from limiter import limiter
from routers import vendors, intelligence, export, quota, auth
from scheduler import start_scheduler
import os

print(">>> CWD:", os.getcwd())
print(">>> DATABASE_URL:", os.getenv("DATABASE_URL"))

Base.metadata.create_all(bind=engine)

# Column-level migrations — adds new fields to existing DBs without data loss
with engine.connect() as _conn:
    _vendor_cols = {row[1] for row in _conn.execute(text("PRAGMA table_info(vendors)")).fetchall()}
    for _col, _ddl in [
        ("description", "ALTER TABLE vendors ADD COLUMN description TEXT"),
        ("auth_method",  "ALTER TABLE vendors ADD COLUMN auth_method VARCHAR"),
        ("two_factor",   "ALTER TABLE vendors ADD COLUMN two_factor VARCHAR"),
        ("user_id",      "ALTER TABLE vendors ADD COLUMN user_id VARCHAR(36)"),
    ]:
        if _col not in _vendor_cols:
            _conn.execute(text(_ddl))
            print(f"[Migration] Added column: {_col}")
    _conn.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield

app = FastAPI(
    title="VenderScope API",
    description="Continuous passive vendor risk intelligence platform",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://venderscope.vercel.app",
        "https://venderscope-3466b3jpg-darkyzowos-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth routes — rate limits applied inline with @limiter.limit
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(vendors.router,     prefix="/api/vendors",     tags=["Vendors"])
app.include_router(intelligence.router,prefix="/api/intelligence",tags=["Intelligence"])
app.include_router(export.router,      prefix="/api/export",      tags=["Export"])
app.include_router(quota.router,       prefix="/api/quota",       tags=["Quota"])


@app.get("/")
def root():
    return {"status": "VenderScope is running 🚀"}
