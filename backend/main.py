from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import vendors, intelligence, export
from scheduler import start_scheduler

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield

app = FastAPI(
    title="VenderScope API",
    description="Continuous passive vendor risk intelligence platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vendors.router, prefix="/api/vendors", tags=["Vendors"])
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["Intelligence"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])

@app.get("/")
def root():
    return {"status": "VenderScope is running 🚀"}