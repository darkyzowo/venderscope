from fastapi import APIRouter
from services.quota import get_quota_status

router = APIRouter()

@router.get("/")
def quota_status():
    return get_quota_status()