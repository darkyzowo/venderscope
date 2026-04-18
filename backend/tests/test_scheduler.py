import uuid

from scheduler import scheduled_scan
from database import Base, SessionLocal, engine
from models import User, Vendor


def test_scheduled_scan_skips_orphan_and_reserved_vendors(monkeypatch):
    suffix = uuid.uuid4().hex[:8]
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = User(email=f"scheduler-owner-{suffix}@company.com", password_hash="hash")
        db.add(user)
        db.commit()
        db.refresh(user)

        real_vendor = Vendor(
            user_id=user.id,
            name="Real Vendor",
            domain="company.com",
        )
        reserved_vendor = Vendor(
            user_id=user.id,
            name="Debug Vendor",
            domain="debug-a2a9f867.example",
        )
        orphan_vendor = Vendor(
            user_id=None,
            name="Orphan Vendor",
            domain="orphan-company.com",
        )
        db.add_all([real_vendor, reserved_vendor, orphan_vendor])
        db.commit()
        db.refresh(real_vendor)
    finally:
        db.close()

    scanned = []

    def fake_run_full_scan(vendor, db_session, force=False):
        scanned.append((vendor.name, vendor.domain, force))
        return 0.0

    monkeypatch.setattr("scheduler.run_full_scan", fake_run_full_scan)

    scheduled_scan()

    assert scanned == [("Real Vendor", "company.com", True)]
