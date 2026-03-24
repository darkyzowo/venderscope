# backend/database.py
import os
import ssl
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

_default_db_path = os.path.join(os.path.dirname(__file__), "vendorscope.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_db_path}")

# Normalise URL dialect:
#   postgres://   → postgresql+pg8000://  (Neon/Render shorthand)
#   postgresql:// → postgresql+pg8000://  (standard, no driver specified)
# pg8000 is pure-Python — works on any Python version including 3.14+
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    _connect_args: dict = {"check_same_thread": False}
else:
    # pg8000 doesn't accept sslmode/channel_binding as URL query params —
    # strip them from the URL and pass an ssl_context object instead.
    _parsed = urlparse(DATABASE_URL)
    _params = {k: v[0] for k, v in parse_qs(_parsed.query).items()
               if k not in ("sslmode", "channel_binding")}
    DATABASE_URL = urlunparse(_parsed._replace(query=urlencode(_params)))

    _ssl_ctx = ssl.create_default_context()
    _connect_args = {"ssl_context": _ssl_ctx}

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
