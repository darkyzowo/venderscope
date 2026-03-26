from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, field_validator
from typing import Literal
from limiter import limiter
from services.scanner import scan_ephemeral
from services.compliance_discovery import _is_safe_domain

router = APIRouter()

_VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}


class GuestScanRequest(BaseModel):
    domain: str
    name: str

    @field_validator("domain")
    @classmethod
    def clean_domain(cls, v: str) -> str:
        v = v.strip().lower()
        v = v.replace("https://", "").replace("http://", "").rstrip("/")
        if not v:
            raise ValueError("Domain cannot be empty")
        if len(v) > 253:
            raise ValueError("Domain must be under 253 characters")
        return v

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 100:
            raise ValueError("Name must be under 100 characters")
        return v


class GuestEventItem(BaseModel):
    source:      str
    severity:    str
    title:       str
    description: str

    @field_validator("source")
    @classmethod
    def clean_source(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 50:
            raise ValueError("source too long")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        if v.upper() not in _VALID_SEVERITIES:
            raise ValueError(f"severity must be one of {_VALID_SEVERITIES}")
        return v.upper()

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        if len(v) > 300:
            raise ValueError("title too long")
        return v.strip()

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError("description too long")
        return v.strip()


class GuestReportRequest(BaseModel):
    name:   str
    domain: str
    score:  float
    events: list[GuestEventItem]

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Invalid name")
        return v

    @field_validator("domain")
    @classmethod
    def clean_domain(cls, v: str) -> str:
        v = v.strip().lower().replace("https://", "").replace("http://", "").rstrip("/")
        if not v or len(v) > 253:
            raise ValueError("Invalid domain")
        return v

    @field_validator("score")
    @classmethod
    def validate_score(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("Score must be between 0 and 100")
        return v

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list) -> list:
        if len(v) > 50:
            raise ValueError("Too many events")
        return v


@router.post("/scan")
@limiter.limit("3/hour")
def guest_scan(request: Request, payload: GuestScanRequest):
    """
    Unauthenticated CVE-only scan. Rate limited 3/hour per real IP.
    Domain validated against SSRF blocklist before any external call is made.
    Zero DB writes — results returned directly and discarded after response.
    """
    if not _is_safe_domain(payload.domain):
        raise HTTPException(status_code=400, detail="Invalid or unsafe domain")
    return scan_ephemeral(payload.domain, payload.name)


@router.post("/report")
@limiter.limit("5/hour")
def guest_report(request: Request, payload: GuestReportRequest):
    """
    Generate a guest PDF from a scan result. Rate limited 5/hour per real IP.
    All user-supplied fields are XML-escaped before reaching ReportLab.
    """
    from services.pdf_export import generate_guest_pdf
    pdf_bytes = generate_guest_pdf(
        name=payload.name,
        domain=payload.domain,
        score=payload.score,
        events=[e.model_dump() for e in payload.events],
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="venderscope-guest-report.pdf"'
        },
    )
