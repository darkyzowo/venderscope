from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Vendor, RiskScoreHistory, User
from services.auth_service import get_current_user
from services.risk_context import compute_effective_score
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

    high_risk   = sum(1 for v in vendors if compute_effective_score(v.risk_score, v.data_sensitivity) >= 70)
    medium_risk = sum(1 for v in vendors if 40 <= compute_effective_score(v.risk_score, v.data_sensitivity) < 70)
    low_risk    = sum(1 for v in vendors if compute_effective_score(v.risk_score, v.data_sensitivity) < 40)

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
                    "id":              v.id,
                    "name":            v.name,
                    "domain":          v.domain,
                    "risk_score":      v.risk_score,
                    "effective_score": compute_effective_score(v.risk_score, v.data_sensitivity),
                    "delta":           delta,
                })

    rising.sort(key=lambda x: x["delta"], reverse=True)

    # Overdue review computation
    now = datetime.now(timezone.utc)
    overdue_reviews = []
    for v in vendors:
        if not v.review_interval_days:
            continue
        if v.last_reviewed_at is None:
            days_overdue = v.review_interval_days  # never reviewed — treat as fully overdue
        else:
            reviewed_utc = v.last_reviewed_at.replace(tzinfo=timezone.utc) if v.last_reviewed_at.tzinfo is None else v.last_reviewed_at
            due_at = reviewed_utc.replace(microsecond=0) + timedelta(days=v.review_interval_days)
            days_overdue = (now - due_at).days
        if days_overdue > 0:
            overdue_reviews.append({
                "id":           v.id,
                "name":         v.name,
                "domain":       v.domain,
                "days_overdue": days_overdue,
            })
    overdue_reviews.sort(key=lambda x: x["days_overdue"], reverse=True)

    return {
        "total":                len(vendors),
        "high_risk":            high_risk,
        "medium_risk":          medium_risk,
        "low_risk":             low_risk,
        "rising":               rising,
        "scanned_last_24h":     scanned_last_24h,
        "overdue_review_count": len(overdue_reviews),
        "overdue_reviews":      overdue_reviews,
    }
