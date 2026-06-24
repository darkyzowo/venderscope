import os
from slowapi import Limiter
from fastapi import Request

# Set RATE_LIMIT_ENABLED=0 to disable for testing
_enabled = os.getenv("RATE_LIMIT_ENABLED", "1") != "0"


def _real_ip(request: Request) -> str:
    """
    Extract real client IP from X-Forwarded-For.
    Uses XFF[-1] (the rightmost entry) — Render appends the real client IP at the end,
    making it unforgeable. XFF[0] is client-controlled and can be spoofed to bypass
    rate limiting, which is critical for unauthenticated endpoints.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


# Shared limiter instance — imported by main.py (attached to app.state)
# and by individual routers (for @limiter.limit() decorators)
limiter = Limiter(key_func=_real_ip, enabled=_enabled)
