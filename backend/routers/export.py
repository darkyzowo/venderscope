from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor, RiskEvent, RiskScoreHistory
from services.pdf_export import generate_vendor_pdf

router = APIRouter()

@router.get("/{vendor_id}/pdf")
def export_vendor_pdf(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    events  = db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor_id)\
                .order_by(RiskEvent.detected_at.desc()).all()
    history = db.query(RiskScoreHistory).filter(RiskScoreHistory.vendor_id == vendor_id)\
                .order_by(RiskScoreHistory.recorded_at.asc()).all()

    pdf = generate_vendor_pdf(vendor, events, history)

    filename = f"vendorscope_{vendor.name.lower().replace(' ', '_')}_report.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )