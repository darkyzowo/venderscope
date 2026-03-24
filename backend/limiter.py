import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Set RATE_LIMIT_ENABLED=0 to disable for testing
_enabled = os.getenv("RATE_LIMIT_ENABLED", "1") != "0"

# Shared limiter instance — imported by main.py (attached to app.state)
# and by individual routers (for @limiter.limit() decorators)
limiter = Limiter(key_func=get_remote_address, enabled=_enabled)
