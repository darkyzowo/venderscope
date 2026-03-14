from datetime import datetime
from sqlalchemy.orm import Session
from models import Vendor, RiskEvent, RiskScoreHistory
from services.hibp import check_domain_breaches
from services.nvd import check_vendor_cves
from services.companies_house import check_company_health
from services.shodan_service import check_shodan_exposure
from services.alerts import send_alert_email
from services.epss import get_epss_scores

SEVERITY_WEIGHTS = {
    "CRITICAL": 25,
    "HIGH":     15,
    "MEDIUM":    7,
    "LOW":       2,
}

def run_full_scan(vendor: Vendor, db: Session) -> float:
    print(f"[Scanner] Scanning {vendor.name} ({vendor.domain})...")
    all_events = []

    # 1. HIBP
    for b in check_domain_breaches(vendor.domain):
        all_events.append({**b, "source": "HIBP"})

    # 2. NVD — CVE check
    cves = check_vendor_cves(vendor.name)
    cve_ids = [c["title"] for c in cves if c["title"].startswith("CVE-")]

    # Enrich with EPSS exploit probability scores
    epss_scores = get_epss_scores(cve_ids)
    for c in cves:
        epss = epss_scores.get(c["title"])
        if epss is not None:
            c["description"] = f"[EPSS: {epss}% exploit probability] " + c.get("description", "")
        all_events.append({**c, "source": "NVD"})

    # 3. Companies House
    if vendor.company_number:
        for e in check_company_health(vendor.company_number):
            all_events.append({**e, "source": "CompaniesHouse"})

    # 4. Shodan
    for s in check_shodan_exposure(vendor.domain):
        all_events.append({**s, "source": "Shodan"})

    # Deduplicate
    existing_titles = {e.title for e in db.query(RiskEvent)
                       .filter(RiskEvent.vendor_id == vendor.id).all()}
    new_events = [e for e in all_events if e["title"] not in existing_titles]

    for evt in new_events:
        db.add(RiskEvent(
            vendor_id   = vendor.id,
            source      = evt.get("source", "Unknown"),
            severity    = evt.get("severity", "LOW"),
            title       = evt["title"],
            description = evt.get("description", ""),
        ))

    # Score
    score = min(
        sum(SEVERITY_WEIGHTS.get(e.get("severity", "LOW"), 2) for e in all_events),
        100.0
    )

    vendor.risk_score   = score
    vendor.last_scanned = datetime.utcnow()
    db.add(RiskScoreHistory(vendor_id=vendor.id, score=score))
    db.commit()

    # 5. Alert if score crossed threshold
    all_stored_events = db.query(RiskEvent)\
                          .filter(RiskEvent.vendor_id == vendor.id).all()
    send_alert_email(vendor.name, vendor.domain, score, all_stored_events)

    print(f"[Scanner] {vendor.name} → Score: {score} | New events: {len(new_events)}")
    return score