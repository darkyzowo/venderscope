import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from datetime import datetime
from database import get_db
from models import Vendor, RiskEvent, RiskScoreHistory

router = APIRouter()

# --- Schemas ---
class VendorCreate(BaseModel):
    name:           str
    domain:         str
    company_number: Optional[str] = None

    @field_validator('name')
    @classmethod
    def name_length(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('Name cannot be empty')
        if len(v) > 100:
            raise ValueError('Name must be under 100 characters')
        return v.strip()

    @field_validator('domain')
    @classmethod
    def domain_length(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('Domain cannot be empty')
        if len(v) > 253:
            raise ValueError('Domain must be under 253 characters')
        return v.strip().lower().replace('https://', '').replace('http://', '').rstrip('/')

class VendorOut(BaseModel):
    id:             int
    name:           str
    domain:         str
    company_number: Optional[str]
    risk_score:     float
    last_scanned:   Optional[datetime] = None
    compliance:     Optional[dict]     = None
    description:    Optional[str]      = None
    auth_method:    Optional[str]      = None
    two_factor:     Optional[str]      = None

    class Config:
        from_attributes = True


# --- Routes ---

@router.get("/", response_model=list[VendorOut])
def list_vendors(db: Session = Depends(get_db)):
    vendors = db.query(Vendor).all()
    for v in vendors:
        if isinstance(v.compliance, str):
            try:
                v.compliance = json.loads(v.compliance)
            except Exception:
                v.compliance = None
    return vendors


@router.post("/", response_model=VendorOut)
def add_vendor(payload: VendorCreate, db: Session = Depends(get_db)):
    existing = db.query(Vendor).filter(Vendor.domain == payload.domain).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vendor domain already exists")
    vendor = Vendor(**payload.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(vendor)
    db.commit()
    return {"message": f"Vendor '{vendor.name}' deleted"}


@router.get("/{vendor_id}/events")
def get_vendor_events(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    events = db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor_id)\
               .order_by(RiskEvent.detected_at.desc()).all()
    return events


@router.get("/{vendor_id}/history")
def get_score_history(vendor_id: int, db: Session = Depends(get_db)):
    history = db.query(RiskScoreHistory)\
                .filter(RiskScoreHistory.vendor_id == vendor_id)\
                .order_by(RiskScoreHistory.recorded_at.asc()).all()
    return history