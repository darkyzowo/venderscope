from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from models import Vendor
from services.scanner import run_full_scan

def scheduled_scan():
    """Nightly job — force fresh scans for all vendors, bypassing cache."""
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

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_scan, "interval", hours=24, id="daily_scan")
    scheduler.start()
    print("[Scheduler] Daily scan job started ✅")