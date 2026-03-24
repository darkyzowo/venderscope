from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor, User
from services.scanner import run_full_scan
from services.auth_service import get_current_user
from services.audit import audit
from limiter import limiter

router = APIRouter()


@router.post("/scan/{vendor_id}")
@limiter.limit("5/minute")
def trigger_scan(
    request: Request,
    vendor_id: str,
    force: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scan a single vendor.
    force=True (default) always fetches fresh data from external APIs.
    force=False uses cached data if scanned within 24hrs.
    """
    # Ownership check — always 404 to prevent existence enumeration
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.user_id == current_user.id,
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    result = run_full_scan(vendor, db, force=force)
    audit(db, "vendor.scanned", request, user_id=str(current_user.id), detail=f"{vendor.domain}:{result}")
    return {"message": f"Scan complete for {vendor.name}", "new_score": result}


@router.post("/scan-all")
@limiter.limit("2/minute")
def scan_all_vendors(
    request: Request,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scan all vendors belonging to the authenticated user.
    force=False (default) uses cache — makes Scan All fast for recently scanned vendors.
    """
    vendors = db.query(Vendor).filter(Vendor.user_id == current_user.id).all()
    results = {}
    for v in vendors:
        try:
            score = run_full_scan(v, db, force=force)
            results[v.name] = score
        except Exception:
            # Don't expose internal error details to the client
            results[v.name] = "scan_failed"
    return {"scanned": len(vendors), "scores": results}
