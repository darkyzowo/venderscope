import httpx
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from models import Vendor, RevokedToken
from services.alerts import _is_reserved_test_domain
from services.scanner import run_full_scan

RENDER_URL = "https://venderscope-api.onrender.com"

def scheduled_scan():
    """Nightly job — force fresh scans for all vendors."""
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

def keep_alive():
    """Pings the API every 10 minutes to prevent Render free tier spin-down."""
    try:
        httpx.get(f"{RENDER_URL}/", timeout=10)
        print("[KeepAlive] Pinged successfully")
    except Exception as e:
        print(f"[KeepAlive] Ping failed: {e}")

def cleanup_revoked_tokens():
    """Purge expired JTI blacklist entries — runs every 6 hours."""
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


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_scan,          "interval", hours=24,   id="daily_scan")
    scheduler.add_job(keep_alive,              "interval", minutes=10, id="keep_alive")
    scheduler.add_job(cleanup_revoked_tokens,  "interval", hours=6,    id="token_cleanup")
    scheduler.start()
    print("[Scheduler] Daily scan + keep-alive + token cleanup jobs started")
