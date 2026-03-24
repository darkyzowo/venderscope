import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor, RiskEvent, RiskScoreHistory, User
from services.pdf_export import generate_vendor_pdf
from services.auth_service import get_current_user
from limiter import limiter

router = APIRouter()

# Allowed characters for PDF filenames — prevents header injection (CRIT-03)
_SAFE_FILENAME = re.compile(r'[^a-z0-9_\-]')


@router.get("/{vendor_id}/pdf")
@limiter.limit("10/minute")
def export_vendor_pdf(
    request: Request,
    vendor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ownership check — always 404 to prevent existence enumeration
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.user_id == current_user.id,
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    events  = db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor_id)\
                .order_by(RiskEvent.detected_at.desc()).all()
    history = db.query(RiskScoreHistory).filter(RiskScoreHistory.vendor_id == vendor_id)\
                .order_by(RiskScoreHistory.recorded_at.asc()).all()

    pdf = generate_vendor_pdf(vendor, events, history)

    # Sanitise vendor name for use in Content-Disposition header — prevents CRIT-03
    safe_name = _SAFE_FILENAME.sub('_', vendor.name.lower().replace(' ', '_'))
    filename = f"vendorscope_{safe_name}_report.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
