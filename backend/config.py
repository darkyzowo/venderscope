import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
_ENV_PATH = _BACKEND_DIR / ".env"

load_dotenv(dotenv_path=_ENV_PATH, override=False)

_LOCAL_FRONTEND_ORIGINS = (
    "http://localhost:5173",
    "http://localhost:5174",
)


def is_production() -> bool:
    return bool(os.getenv("RENDER"))


def _normalize_origin(value: str) -> str:
    value = (value or "").strip().rstrip("/")
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    return value


def _split_origins(raw: str) -> list[str]:
    return [
        origin
        for origin in (_normalize_origin(part) for part in raw.split(","))
        if origin
    ]


@lru_cache(maxsize=1)
def get_frontend_origins() -> tuple[str, ...]:
    origins: list[str] = []

    if not is_production():
        origins.extend(_LOCAL_FRONTEND_ORIGINS)

    primary = _normalize_origin(os.getenv("FRONTEND_URL", ""))
    if primary:
        origins.append(primary)

    origins.extend(_split_origins(os.getenv("FRONTEND_ORIGINS", "")))

    deduped: list[str] = []
    for origin in origins:
        if origin not in deduped:
            deduped.append(origin)
    return tuple(deduped)


def get_primary_frontend_url() -> str:
    origins = get_frontend_origins()
    if origins:
        return origins[0]
    return _LOCAL_FRONTEND_ORIGINS[0]


def validate_frontend_config() -> None:
    origins = get_frontend_origins()
    if not is_production():
        return
    if not origins:
        raise RuntimeError(
            "FRONTEND_URL environment variable is required in production."
        )
    if any("localhost" in origin for origin in origins):
        raise RuntimeError(
            "Frontend origin configuration contains localhost in production. "
            "Set FRONTEND_URL/FRONTEND_ORIGINS to deployed frontend URL(s)."
        )


def is_allowed_frontend_origin(origin: str) -> bool:
    normalized = _normalize_origin(origin)
    if not normalized:
        return False
    return normalized in get_frontend_origins()
