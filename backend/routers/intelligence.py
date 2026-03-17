from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor
from services.scanner import run_full_scan
from services.quota import get_quota_status, get_remaining_full_scans


router = APIRouter()

@router.post("/scan/{vendor_id}")
def trigger_scan(vendor_id: int, force: bool = True, db: Session = Depends(get_db)):
    """
    Scan a single vendor.
    force=True (default) always fetches fresh data from external APIs.
    force=False uses cached data if scanned within 24hrs.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    result = run_full_scan(vendor, db, force=force)
    return {"message": f"Scan complete for {vendor.name}", "new_score": result}

@router.post("/scan-all")
def scan_all_vendors(force: bool = False, db: Session = Depends(get_db)):
    """
    Scan all vendors.
    force=False (default) uses cache — makes Scan All fast for recently scanned vendors.
    force=True fetches fresh data for everything.
    """
    vendors = db.query(Vendor).all()
    results = {}
    for v in vendors:
        try:
            score = run_full_scan(v, db, force=force)
            results[v.name] = score
        except Exception as e:
            results[v.name] = f"error: {str(e)}"
    return {"scanned": len(vendors), "scores": results}
    
@router.get("/")
def quota_status():
    """
    Returns current Google CSE quota status.
    Used by the frontend to show the scan quota banner.
    """
    status = get_quota_status()
    status["full_scans_remaining"] = get_remaining_full_scans()
    return status