from fastapi import APIRouter
from database import engine, Base
from services.alerts import send_alert_email

router = APIRouter()

@router.post("/reset-db")
def reset_database():
    """Drops and recreates all tables. TEMPORARY — remove after use."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"message": "Database wiped and recreated successfully ✅"}

@router.post("/test-email")
def test_email():
    """Sends a test alert email. TEMPORARY — remove after use."""
    class MockEvent:
        source   = "NVD"
        title    = "CVE-2024-TEST"
        severity = "CRITICAL"
        description = "Test event to verify email delivery from Render."
    try:
        send_alert_email("Test Vendor", "testvendor.com", 95.0, [MockEvent()])
        return {"message": "Email triggered — check your inbox ✅"}
    except Exception as e:
        return {"message": f"Email failed: {str(e)} ❌"}