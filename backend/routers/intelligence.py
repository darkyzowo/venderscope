# backend/routers/intelligence.py
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

@router.post("/scan-all")
def scan_all_vendors(db: Session = Depends(get_db)):
    vendors = db.query(Vendor).all()
    results = {}
    for v in vendors:
        score = run_full_scan(v, db)
        results[v.name] = score
    return {"scanned": len(vendors), "scores": results}