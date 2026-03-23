import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from models import Vendor
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

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_scan, "interval", hours=24,  id="daily_scan")
    scheduler.add_job(keep_alive,     "interval", minutes=10, id="keep_alive")
    scheduler.start()
    print("[Scheduler] Daily scan + keep-alive jobs started")