import json
import threading as _threading
from datetime import datetime, timezone, timedelta
from pathlib import Path

# NOTE: quota.json persists to Render's ephemeral filesystem. On Render free tier,
# any redeploy, restart, or instance recycle resets the file and the daily counter.
# This means the 100/day Google CSE quota can be bypassed by triggering a redeploy.
# For strict enforcement, migrate quota state to the PostgreSQL database (Phase 3).

QUOTA_FILE  = Path(__file__).resolve().parent.parent / "quota.json"
DAILY_LIMIT = 100  # Google CSE free tier
SCAN_COST   = 14   # worst-case queries per full scan (2 × 6 certs + ~2 contact searches)

# RLock (reentrant) rather than Lock: _ensure_loaded() may call _persist() internally,
# so the same thread must be able to re-acquire without deadlocking.
_quota_lock = _threading.RLock()

# In-memory state — loaded once at import, persisted to disk only on mutation
_state: dict = {}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _persist():
    with _quota_lock:
        QUOTA_FILE.write_text(json.dumps(_state, indent=2))


def _ensure_loaded():
    """Populate _state from disk on first call; auto-reset if it's a new UTC day."""
    global _state
    if not _state:
        if QUOTA_FILE.exists():
            try:
                with _quota_lock:
                    _state = json.loads(QUOTA_FILE.read_text())
            except Exception:
                _state = {}
        if _state.get("date") != _today():
            _state = {"used": 0, "date": _today()}
            _persist()


def get_quota_status() -> dict:
    """Returns current quota state for the /api/quota endpoint."""
    _ensure_loaded()
    # Auto-reset in memory if day rolled over since last call
    if _state.get("date") != _today():
        _state.update({"used": 0, "date": _today()})
        _persist()

    used      = _state["used"]
    remaining = max(0, DAILY_LIMIT - used)
    now       = datetime.now(timezone.utc)
    resets_at = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    return {
        "used":                 used,
        "remaining":            remaining,
        "limit":                DAILY_LIMIT,
        "resets_at":            resets_at.isoformat(),
        "exhausted":            remaining < SCAN_COST,
        "full_scans_remaining": max(0, remaining) // SCAN_COST,
    }


def check_and_consume() -> bool:
    """
    Call before firing Google CSE searches.
    Returns True and consumes SCAN_COST units if quota allows.
    Returns False if exhausted — caller skips web search stage.
    """
    _ensure_loaded()
    if _state["used"] + SCAN_COST > DAILY_LIMIT:
        print(f"[Quota] Exhausted — {_state['used']}/{DAILY_LIMIT} units used today.")
        return False
    _state["used"] += SCAN_COST
    _persist()
    remaining_scans = max(0, DAILY_LIMIT - _state["used"]) // SCAN_COST
    print(f"[Quota] Consumed {SCAN_COST} units — {_state['used']}/{DAILY_LIMIT} used today "
          f"({remaining_scans} full scans remaining).")
    return True


def get_remaining_full_scans(data: dict = None) -> int:
    """How many full scans remain today (for display in the banner)."""
    _ensure_loaded()
    used = (data or _state)["used"]
    return max(0, DAILY_LIMIT - used) // SCAN_COST