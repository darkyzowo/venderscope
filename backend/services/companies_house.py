# backend/services/companies_house.py
import requests
import os
from dotenv import load_dotenv

load_dotenv()

CH_API_KEY = os.getenv("COMPANIES_HOUSE_API_KEY")
CH_BASE = "https://api.company-information.service.gov.uk"

def check_company_health(company_number: str) -> list[dict]:
    """
    Checks Companies House for financial/governance risk signals:
    - Company status (active, dissolved, liquidation)
    - Recent filing gaps (overdue accounts)
    - Director changes
    """
    if not company_number:
        return []

    events = []

    try:
        # 1. Company profile — status check
        profile = requests.get(
            f"{CH_BASE}/company/{company_number}",
            auth=(CH_API_KEY, ""),
            timeout=10
        ).json()

        status = profile.get("company_status", "unknown")
        name   = profile.get("company_name", "Unknown")

        if status != "active":
            events.append({
                "title": f"{name} — Status: {status.upper()}",
                "description": f"Companies House reports this company is '{status}'. Assess continuity risk immediately.",
                "severity": "CRITICAL" if status in ["liquidation", "dissolved"] else "HIGH"
            })

        # 2. Overdue filing check
        accounts = profile.get("accounts", {})
        overdue  = accounts.get("overdue", False)
        if overdue:
            events.append({
                "title": f"{name} — Overdue Accounts Filing",
                "description": "Company has overdue accounts at Companies House. Possible financial distress signal.",
                "severity": "HIGH"
            })

        # 3. Recent officer changes (director turnover)
        officers_resp = requests.get(
            f"{CH_BASE}/company/{company_number}/officers",
            auth=(CH_API_KEY, ""),
            timeout=10
        ).json()

        officers = officers_resp.get("items", [])
        recent_resignations = [
            o for o in officers
            if o.get("resigned_on") and o.get("officer_role") == "director"
        ]

        if len(recent_resignations) >= 2:
            events.append({
                "title": f"{name} — {len(recent_resignations)} Director Resignation(s) on Record",
                "description": "Multiple director resignations detected. This may signal governance instability.",
                "severity": "MEDIUM"
            })

    except Exception as e:
        print(f"[CompaniesHouse] Error for {company_number}: {e}")

    return events