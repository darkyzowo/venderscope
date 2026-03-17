import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

QUOTA_FILE  = Path(__file__).resolve().parent.parent / "quota.json"
DAILY_LIMIT = 100  # Google CSE free tier
SCAN_COST   = 14   # worst-case queries per full scan (2 × 6 certs + ~2 contact searches)


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _load() -> dict:
    if QUOTA_FILE.exists():
        try:
            data = json.loads(QUOTA_FILE.read_text())
            # Auto-reset if it's a new UTC day
            if data.get("date") != _today():
                fresh = {"used": 0, "date": _today()}
                _save(fresh)
                return fresh
            return data
        except Exception:
            pass
    # First run — seed with 28 units already used (2 scans pre-tracking)
    initial = {"used": 28, "date": _today()}
    _save(initial)
    return initial


def _save(data: dict):
    QUOTA_FILE.write_text(json.dumps(data, indent=2))


def get_quota_status() -> dict:
    """Returns current quota state for the /api/quota endpoint."""
    data      = _load()
    used      = data["used"]
    remaining = max(0, DAILY_LIMIT - used)

    # Next midnight UTC
    now       = datetime.now(timezone.utc)
    resets_at = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    return {
        "used":                used,
        "remaining":           remaining,
        "limit":               DAILY_LIMIT,
        "resets_at":           resets_at.isoformat(),
        "exhausted":           remaining < SCAN_COST,
        "full_scans_remaining": get_remaining_full_scans(data),
    }


def check_and_consume() -> bool:
    """
    Call before firing Google CSE searches.
    Returns True and consumes SCAN_COST units if quota allows.
    Returns False if exhausted — caller skips web search stage.
    """
    data = _load()
    if data["used"] + SCAN_COST > DAILY_LIMIT:
        print(f"[Quota] Exhausted — {data['used']}/{DAILY_LIMIT} units used today.")
        return False
    data["used"] += SCAN_COST
    _save(data)
    print(f"[Quota] Consumed {SCAN_COST} units — {data['used']}/{DAILY_LIMIT} used today "
          f"({get_remaining_full_scans(data)} full scans remaining).")
    return True


def get_remaining_full_scans(data: dict = None) -> int:
    """How many full scans remain today (for display in the banner)."""
    if data is None:
        data = _load()
    remaining_units = max(0, DAILY_LIMIT - data["used"])
    return remaining_units // SCAN_COST