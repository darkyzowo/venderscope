import httpx
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from models import Vendor, RevokedToken
from services.scanner import run_full_scan

RENDER_URL = "https://venderscope-api.onrender.com"

def scheduled_scan():
    """Nightly job — force fresh scans for all vendors."""
    db = SessionLocal()
    try:
        vendors = db.query(Vendor).all()
        for vendor in vendors:
            try:
                run_full_scan(vendor, db, force=True)
            except Exception as e:
                print(f"[Scheduler] Error scanning {vendor.name}: {e}")
        print(f"[Scheduler] Nightly scan complete — {len(vendors)} vendors refreshed")
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