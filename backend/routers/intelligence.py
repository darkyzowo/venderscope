from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor
from services.scanner import run_full_scan

router = APIRouter()

@router.post("/scan/{vendor_id}")
def trigger_scan(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    result = run_full_scan(vendor, db)
    return {"message": f"Scan complete for {vendor.name}", "new_score": result}

import threading

@router.post("/scan-all")
def scan_all_vendors(db: Session = Depends(get_db)):
    vendors = db.query(Vendor).all()
    vendor_ids = [v.id for v in vendors]

    def run_scans():
        from database import SessionLocal
        scan_db = SessionLocal()
        try:
            for vid in vendor_ids:
                try:
                    vendor = scan_db.query(Vendor).filter(Vendor.id == vid).first()
                    if vendor:
                        run_full_scan(vendor, scan_db)
                except Exception as e:
                    print(f"[ScanAll] Error scanning vendor {vid}: {e}")
        finally:
            scan_db.close()

    thread = threading.Thread(target=run_scans, daemon=True)
    thread.start()

    return {"message": f"Scanning {len(vendor_ids)} vendors in background", "vendor_ids": vendor_ids}