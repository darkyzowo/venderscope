import os
from slowapi import Limiter
from fastapi import Request

# Set RATE_LIMIT_ENABLED=0 to disable for testing
_enabled = os.getenv("RATE_LIMIT_ENABLED", "1") != "0"


# Number of trusted reverse proxies in front of the app. Each trusted proxy
# appends its immediate peer to X-Forwarded-For, so the real client IP is the
# Nth entry counted from the RIGHT. Anything to the left of the trusted proxies
# is client-controlled and spoofable. Render appends the client IP last
# (hops=1). Other platforms (e.g. Hugging Face Spaces) may differ — set
# TRUSTED_PROXY_HOPS to match your deployment so an attacker cannot forge
# X-Forwarded-For to rotate IPs and bypass rate limiting.
try:
    _TRUSTED_PROXY_HOPS = max(1, int(os.getenv("TRUSTED_PROXY_HOPS", "1")))
except ValueError:
    _TRUSTED_PROXY_HOPS = 1


def client_ip(request: Request) -> str:
    """Resolve the real client IP, accounting for TRUSTED_PROXY_HOPS proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            idx = min(_TRUSTED_PROXY_HOPS, len(parts))
            return parts[-idx]
    return request.client.host if request.client else "unknown"


def _real_ip(request: Request) -> str:
    return client_ip(request)


# Shared limiter instance — imported by main.py (attached to app.state)
# and by individual routers (for @limiter.limit() decorators)
limiter = Limiter(key_func=_real_ip, enabled=_enabled)
