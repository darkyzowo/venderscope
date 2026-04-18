from database import Base, SessionLocal, engine
from models import SearchQuotaUsage
import services.quota as quota


def test_quota_consumption_persists_in_database():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        db.query(SearchQuotaUsage).delete()
        db.commit()
    finally:
        db.close()

    status_before = quota.get_quota_status()
    assert quota.consume_search_units(3) is True
    status_after = quota.get_quota_status()

    assert status_after["used"] == status_before["used"] + 3
    assert status_after["remaining"] == status_before["remaining"] - 3

    db = SessionLocal()
    try:
        row = db.get(SearchQuotaUsage, quota._today())
        assert row is not None
        assert row.used == status_after["used"]
    finally:
        db.close()


def test_quota_auto_resets_on_new_utc_day(monkeypatch):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        db.query(SearchQuotaUsage).delete()
        db.merge(SearchQuotaUsage(quota_date="1999-12-31", used=42))
        db.commit()
    finally:
        db.close()

    monkeypatch.setattr(quota, "_today", lambda: "1999-12-31")
    old_day = quota.get_quota_status()
    assert old_day["used"] == 42

    monkeypatch.setattr(quota, "_today", lambda: "2000-01-01")
    new_day = quota.get_quota_status()
    assert new_day["used"] == 0
    assert new_day["remaining"] == quota.DAILY_LIMIT
