from fastapi import APIRouter
from services.quota import get_quota_status, get_remaining_full_scans

router = APIRouter()

@router.get("/")
def quota_status():
    status = get_quota_status()
    status["full_scans_remaining"] = get_remaining_full_scans()
    return status