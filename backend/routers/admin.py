from fastapi import APIRouter
from database import engine, Base

router = APIRouter()

@router.post("/reset-db")
def reset_database():
    """
    Drops and recreates all tables — wipes all vendors, events and history.
    TEMPORARY ENDPOINT — remove after use.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"message": "Database wiped and recreated successfully ✅"}