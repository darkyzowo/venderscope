from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Vendor(Base):
    __tablename__ = "vendors"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, nullable=False)
    domain         = Column(String, unique=True, nullable=False)
    company_number = Column(String, nullable=True)
    risk_score     = Column(Float, default=0.0)
    added_at       = Column(DateTime, default=datetime.utcnow)
    last_scanned   = Column(DateTime, nullable=True)
    compliance     = Column(Text, nullable=True)  # JSON stored as string
    description    = Column(Text,   nullable=True)
    auth_method    = Column(String, nullable=True)
    two_factor     = Column(String, nullable=True)

    events  = relationship("RiskEvent",        back_populates="vendor", cascade="all, delete")
    scores  = relationship("RiskScoreHistory", back_populates="vendor", cascade="all, delete")


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id          = Column(Integer, primary_key=True, index=True)
    vendor_id   = Column(Integer, ForeignKey("vendors.id"))
    source      = Column(String)        # e.g. "HIBP", "NVD", "CompaniesHouse", "News"
    severity    = Column(String)        # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    title       = Column(String)
    description = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="events")


class RiskScoreHistory(Base):
    __tablename__ = "risk_score_history"

    id         = Column(Integer, primary_key=True, index=True)
    vendor_id  = Column(Integer, ForeignKey("vendors.id"))
    score      = Column(Float)
    recorded_at= Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="scores")