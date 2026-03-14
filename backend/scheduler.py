# backend/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from models import Vendor
from services.scanner import run_full_scan

def scheduled_scan():
    db = SessionLocal()
    try:
        vendors = db.query(Vendor).all()
        for vendor in vendors:
            run_full_scan(vendor, db)
        print(f"[Scheduler] Scanned {len(vendors)} vendors")
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Runs every 24 hours automatically
    scheduler.add_job(scheduled_scan, "interval", hours=24, id="daily_scan")
    scheduler.start()
    print("[Scheduler] Daily scan job started ✅")