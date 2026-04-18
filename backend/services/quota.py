import os
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import _is_sqlite
from database import SessionLocal
from models import SearchQuotaUsage

DAILY_LIMIT = 100  # Google CSE free tier
ESTIMATED_SCAN_COST = 6  # Practical estimate after on-site discovery resolves many vendors


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _get_or_create_today_quota(db) -> SearchQuotaUsage:
    quota = db.get(SearchQuotaUsage, _today())
    if quota:
        return quota
    quota = SearchQuotaUsage(quota_date=_today(), used=0)
    db.add(quota)
    db.flush()
    return quota


def _build_status(used: int) -> dict:
    remaining = max(0, DAILY_LIMIT - used)
    now = datetime.now(timezone.utc)
    resets_at = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return {
        "used": used,
        "remaining": remaining,
        "limit": DAILY_LIMIT,
        "resets_at": resets_at.isoformat(),
        "exhausted": remaining <= 0,
        "search_units_remaining": remaining,
        "full_scans_remaining": max(0, remaining) // ESTIMATED_SCAN_COST,
    }


def _get_or_create_today_quota_for_update(db) -> SearchQuotaUsage:
    quota_date = _today()
    stmt = select(SearchQuotaUsage).where(SearchQuotaUsage.quota_date == quota_date)
    if not _is_sqlite:
        stmt = stmt.with_for_update()

    quota = db.execute(stmt).scalar_one_or_none()
    if quota:
        return quota

    quota = SearchQuotaUsage(quota_date=quota_date, used=0)
    db.add(quota)
    try:
        db.flush()
        return quota
    except IntegrityError:
        db.rollback()
        retry_stmt = select(SearchQuotaUsage).where(SearchQuotaUsage.quota_date == quota_date)
        if not _is_sqlite:
            retry_stmt = retry_stmt.with_for_update()
        return db.execute(retry_stmt).scalar_one()


def get_quota_status() -> dict:
    """Returns current quota state from the database-backed daily usage row."""
    db = SessionLocal()
    try:
        quota = _get_or_create_today_quota(db)
        db.commit()
        return _build_status(quota.used)
    finally:
        db.close()


def consume_search_units(units: int = 1) -> bool:
    """Consume Google CSE units only when an external search is actually performed."""
    if units <= 0:
        return True

    db = SessionLocal()
    try:
        quota = _get_or_create_today_quota_for_update(db)
        if quota.used + units > DAILY_LIMIT:
            print(f"[Quota] Exhausted — {quota.used}/{DAILY_LIMIT} units used today.")
            db.rollback()
            return False

        quota.used += units
        db.commit()

        remaining_scans = max(0, DAILY_LIMIT - quota.used) // ESTIMATED_SCAN_COST
        print(f"[Quota] Consumed {units} unit(s) — {quota.used}/{DAILY_LIMIT} used today "
              f"({remaining_scans} estimated full scans remaining).")
        return True
    finally:
        db.close()


def refund_search_units(units: int = 1) -> bool:
    """Refund previously reserved search units after an external request failure."""
    if units <= 0:
        return True

    db = SessionLocal()
    try:
        quota = _get_or_create_today_quota_for_update(db)
        quota.used = max(0, quota.used - units)
        db.commit()
        print(f"[Quota] Refunded {units} unit(s) — {quota.used}/{DAILY_LIMIT} used today.")
        return True
    finally:
        db.close()


def search_is_configured() -> bool:
    return bool(os.getenv("GOOGLE_CSE_API_KEY") and os.getenv("GOOGLE_CSE_ID"))


def get_remaining_full_scans(data: dict = None) -> int:
    """Estimated full scans remaining today, based on average external search usage."""
    if data is not None:
        used = data["used"]
        return max(0, DAILY_LIMIT - used) // ESTIMATED_SCAN_COST
    return get_quota_status()["full_scans_remaining"]
