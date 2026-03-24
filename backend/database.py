# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

_default_db_path = os.path.join(os.path.dirname(__file__), "vendorscope.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_db_path}")

# Normalise URL dialect:
#   postgres://        → postgresql+pg8000://   (Neon/Render shorthand)
#   postgresql://      → postgresql+pg8000://   (standard, but no driver specified)
# pg8000 is pure-Python so it works on any Python version including 3.14+
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")

# check_same_thread is SQLite-only
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

# Cloud PostgreSQL needs pre-ping to recover stale connections after idle periods
_engine_kwargs: dict = {"connect_args": _connect_args}
if not _is_sqlite:
    _engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    })

engine = create_engine(DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
