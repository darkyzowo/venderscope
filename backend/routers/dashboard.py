from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor, RiskScoreHistory, User
from services.auth_service import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate stats for the dashboard.
    Returns vendor counts by risk band, rising score vendors, and recent scan activity.
    """
    vendors = db.query(Vendor).filter(Vendor.user_id == current_user.id).all()
    if not vendors:
        return {
            "total": 0,
            "high_risk": 0,
            "medium_risk": 0,
            "low_risk": 0,
            "rising": [],
            "scanned_last_24h": 0,
        }

    high_risk   = sum(1 for v in vendors if v.risk_score >= 70)
    medium_risk = sum(1 for v in vendors if 40 <= v.risk_score < 70)
    low_risk    = sum(1 for v in vendors if v.risk_score < 40)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    scanned_last_24h = sum(
        1 for v in vendors
        if v.last_scanned and v.last_scanned.replace(tzinfo=timezone.utc) >= cutoff
    )

    # Vendors with rising scores (positive delta)
    rising = []
    for v in vendors:
        history = (
            db.query(RiskScoreHistory)
            .filter(RiskScoreHistory.vendor_id == v.id)
            .order_by(RiskScoreHistory.recorded_at.desc())
            .limit(2)
            .all()
        )
        if len(history) >= 2:
            delta = round(history[0].score - history[1].score, 1)
            if delta > 0:
                rising.append({
                    "id":         v.id,
                    "name":       v.name,
                    "domain":     v.domain,
                    "risk_score": v.risk_score,
                    "delta":      delta,
                })

    rising.sort(key=lambda x: x["delta"], reverse=True)

    return {
        "total":            len(vendors),
        "high_risk":        high_risk,
        "medium_risk":      medium_risk,
        "low_risk":         low_risk,
        "rising":           rising,
        "scanned_last_24h": scanned_last_24h,
    }
