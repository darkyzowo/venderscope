import uuid
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import SessionLocal, _is_sqlite
from models import RevokedToken, SchedulerLease, Vendor
from services.alerts import _is_reserved_test_domain
from services.scanner import run_full_scan

RENDER_URL = "https://venderscope-api.onrender.com"
LEASE_NAME = "primary"
LEASE_TTL = timedelta(minutes=15)


def _utcnow():
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _acquire_scheduler_lease(owner_id: str) -> bool:
    db = SessionLocal()
    try:
        now = _utcnow()
        stmt = select(SchedulerLease).where(SchedulerLease.name == LEASE_NAME)
        if not _is_sqlite:
            stmt = stmt.with_for_update()

        lease = db.execute(stmt).scalar_one_or_none()
        if lease is None:
            db.add(SchedulerLease(name=LEASE_NAME, owner_id=owner_id, refreshed_at=now))
            try:
                db.commit()
                return True
            except IntegrityError:
                db.rollback()
        else:
            refreshed_at = _as_utc(lease.refreshed_at)
            if lease.owner_id == owner_id or (refreshed_at and refreshed_at < now - LEASE_TTL):
                lease.owner_id = owner_id
                lease.refreshed_at = now
                db.commit()
                return True
            db.rollback()
        return False
    finally:
        db.close()


def _refresh_scheduler_lease(owner_id: str) -> bool:
    db = SessionLocal()
    try:
        lease = db.get(SchedulerLease, LEASE_NAME)
        if not lease or lease.owner_id != owner_id:
            db.rollback()
            return False
        lease.refreshed_at = _utcnow()
        db.commit()
        return True
    finally:
        db.close()


def _has_scheduler_lease(owner_id: str) -> bool:
    db = SessionLocal()
    try:
        lease = db.get(SchedulerLease, LEASE_NAME)
        if not lease:
            return False
        refreshed_at = _as_utc(lease.refreshed_at)
        return lease.owner_id == owner_id and bool(refreshed_at and refreshed_at >= _utcnow() - LEASE_TTL)
    finally:
        db.close()


def scheduled_scan(owner_id: str):
    """Nightly job — force fresh scans for all vendors."""
    if not _has_scheduler_lease(owner_id):
        print("[Scheduler] Skipping nightly scan — lease not held by this instance")
        return

    db = SessionLocal()
    try:
        vendor_ids = [vendor_id for (vendor_id,) in db.query(Vendor.id).filter(Vendor.user_id.isnot(None)).all()]
        scanned = 0
        skipped = 0
        for vendor_id in vendor_ids:
            vendor_db = SessionLocal()
            vendor = None
            try:
                vendor = vendor_db.get(Vendor, vendor_id)
                if not vendor or not vendor.user_id:
                    skipped += 1
                    continue
                if _is_reserved_test_domain(vendor.domain):
                    print(f"[Scheduler] Skipping reserved/test vendor {vendor.name} ({vendor.domain})")
                    skipped += 1
                    continue
                run_full_scan(vendor, vendor_db, force=True)
                scanned += 1
            except Exception as e:
                vendor_label = vendor.name if vendor else vendor_id
                print(f"[Scheduler] Error scanning {vendor_label}: {e}")
            finally:
                vendor_db.close()
        print(f"[Scheduler] Nightly scan complete — scanned {scanned}, skipped {skipped}")
    finally:
        db.close()


def keep_alive(owner_id: str):
    """Pings the API every 10 minutes to prevent Render free tier spin-down."""
    if not _has_scheduler_lease(owner_id):
        return
    try:
        httpx.get(f"{RENDER_URL}/", timeout=10)
        print("[KeepAlive] Pinged successfully")
    except Exception as e:
        print(f"[KeepAlive] Ping failed: {e}")


def cleanup_revoked_tokens(owner_id: str):
    """Purge expired JTI blacklist entries — runs every 6 hours."""
    if not _has_scheduler_lease(owner_id):
        return
    db = SessionLocal()
    try:
        deleted = db.query(RevokedToken).filter(
            RevokedToken.expires_at < datetime.now(timezone.utc)
        ).delete()
        db.commit()
        if deleted:
            print(f"[Scheduler] Purged {deleted} expired revoked token(s)")
    finally:
        db.close()


def refresh_scheduler_lease(owner_id: str):
    if not _refresh_scheduler_lease(owner_id):
        print("[Scheduler] Lease refresh failed — another instance owns the scheduler")


def start_scheduler():
    owner_id = str(uuid.uuid4())
    if not _acquire_scheduler_lease(owner_id):
        print("[Scheduler] Another instance already owns background jobs — skipping local scheduler start")
        return None

    scheduler = BackgroundScheduler()
    scheduler.add_job(refresh_scheduler_lease, "interval", minutes=2, id="scheduler_lease", args=[owner_id])
    scheduler.add_job(scheduled_scan, "interval", hours=24, id="daily_scan", args=[owner_id])
    scheduler.add_job(keep_alive, "interval", minutes=10, id="keep_alive", args=[owner_id])
    scheduler.add_job(cleanup_revoked_tokens, "interval", hours=6, id="token_cleanup", args=[owner_id])
    scheduler.start()
    print("[Scheduler] Daily scan + keep-alive + token cleanup jobs started")
    return scheduler
