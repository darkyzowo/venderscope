from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from database import engine, Base
import models
from routers import vendors, intelligence, export, quota
from scheduler import start_scheduler
import os

print(">>> CWD:", os.getcwd())
print(">>> DATABASE_URL:", os.getenv("DATABASE_URL"))

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield

# Rate limiter — prevents API abuse
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="VenderScope API",
    description="Continuous passive vendor risk intelligence platform",
    version="1.0.0",
    lifespan=lifespan
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vendors.router,      prefix="/api/vendors",      tags=["Vendors"])
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["Intelligence"])
app.include_router(export.router,       prefix="/api/export",       tags=["Export"])
app.include_router(quota.router,        prefix="/api/quota",        tags=["Quota"])

@app.get("/")
def root():
    return {"status": "VenderScope is running 🚀"}