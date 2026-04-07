from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from database import get_db
from models import Vendor, RiskAcceptance
from services.auth_service import get_current_user
from services.audit import audit
from limiter import limiter

router = APIRouter()

_VALID_TYPES = frozenset({"CVE", "BREACH", "COMPLIANCE", "GENERAL"})


class AcceptanceCreate(BaseModel):
    event_id:      Optional[int] = None
    finding_ref:   str
    finding_type:  str
    justification: str
    reviewer:      str
    expires_at:    datetime

    @field_validator('finding_ref')
    @classmethod
    def ref_length(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('finding_ref is required')
        if len(v) > 150:
            raise ValueError('finding_ref must be under 150 characters')
        return v

    @field_validator('finding_type')
    @classmethod
    def valid_type(cls, v):
        if v not in _VALID_TYPES:
            raise ValueError('finding_type must be CVE, BREACH, COMPLIANCE, or GENERAL')
        return v

    @field_validator('justification')
    @classmethod
    def justification_length(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Justification is required')
        if len(v) > 2000:
            raise ValueError('Justification must be under 2000 characters')
        return v

    @field_validator('reviewer')
    @classmethod
    def reviewer_length(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Reviewer name is required')
        if len(v) > 100:
            raise ValueError('Reviewer name must be under 100 characters')
        return v

    @field_validator('expires_at')
    @classmethod
    def expires_in_future(cls, v):
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= now:
            raise ValueError('expires_at must be in the future')
        try:
            one_year = now.replace(year=now.year + 1)
        except ValueError:
            one_year = now.replace(month=2, day=28, year=now.year + 1)
        if v > one_year:
            raise ValueError('expires_at cannot be more than 1 year from today')
        return v


@router.get("/{vendor_id}/acceptances")
def list_acceptances(
    vendor_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.user_id == current_user.id,
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    now = datetime.now(timezone.utc)
    acceptances = (
        db.query(RiskAcceptance)
        .filter(RiskAcceptance.vendor_id == vendor_id)
        .order_by(RiskAcceptance.created_at.desc())
        .all()
    )
    # Return all; client distinguishes active vs expired via expires_at
    return [
        {
            "id":            a.id,
            "event_id":      a.event_id,
            "finding_ref":   a.finding_ref,
            "finding_type":  a.finding_type,
            "justification": a.justification,
            "reviewer":      a.reviewer,
            "expires_at":    a.expires_at,
            "created_at":    a.created_at,
            "is_active":     a.expires_at.replace(tzinfo=timezone.utc) > now if a.expires_at.tzinfo is None else a.expires_at > now,
        }
        for a in acceptances
    ]


@router.post("/{vendor_id}/acceptances")
@limiter.limit("10/minute")
def create_acceptance(
    request: Request,
    vendor_id: str,
    payload: AcceptanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.user_id == current_user.id,
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    acceptance = RiskAcceptance(
        vendor_id=vendor_id,
        user_id=str(current_user.id),
        event_id=payload.event_id,
        finding_ref=payload.finding_ref,
        finding_type=payload.finding_type,
        justification=payload.justification,
        reviewer=payload.reviewer,
        expires_at=payload.expires_at,
    )
    db.add(acceptance)
    db.commit()
    db.refresh(acceptance)
    audit(db, "vendor.risk_accepted", request, user_id=str(current_user.id),
          detail=f"{vendor_id}:{payload.finding_ref}")
    return {
        "id":           acceptance.id,
        "event_id":     acceptance.event_id,
        "finding_ref":  acceptance.finding_ref,
        "finding_type": acceptance.finding_type,
        "reviewer":     acceptance.reviewer,
        "expires_at":   acceptance.expires_at,
        "created_at":   acceptance.created_at,
        "is_active":    True,
    }


@router.delete("/{vendor_id}/acceptances/{acceptance_id}")
@limiter.limit("10/minute")
def revoke_acceptance(
    request: Request,
    vendor_id: str,
    acceptance_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.user_id == current_user.id,
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    acceptance = db.query(RiskAcceptance).filter(
        RiskAcceptance.id == acceptance_id,
        RiskAcceptance.vendor_id == vendor_id,
        RiskAcceptance.user_id == str(current_user.id),
    ).first()
    if not acceptance:
        raise HTTPException(status_code=404, detail="Acceptance not found")
    db.delete(acceptance)
    db.commit()
    audit(db, "vendor.risk_acceptance_revoked", request, user_id=str(current_user.id),
          detail=f"{vendor_id}:{acceptance_id}")
    return {"message": "Acceptance revoked"}
