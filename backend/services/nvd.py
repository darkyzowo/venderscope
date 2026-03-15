from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
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

    # Run HIBP, NVD, Shodan concurrently — 3-4x faster than sequential
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_hibp   = executor.submit(check_domain_breaches, vendor.domain)
        future_nvd    = executor.submit(check_vendor_cves, vendor.name)
        future_shodan = executor.submit(check_shodan_exposure, vendor.domain)
        future_ch     = executor.submit(check_company_health, vendor.company_number) \
                        if vendor.company_number else None

        hibp_results   = future_hibp.result()
        nvd_results    = future_nvd.result()
        shodan_results = future_shodan.result()
        ch_results     = future_ch.result() if future_ch else []

    # Enrich CVEs with EPSS exploit probability
    cve_ids = [c["title"] for c in nvd_results if c["title"].startswith("CVE-")]
    epss_scores = get_epss_scores(cve_ids)

    for b in hibp_results:
        all_events.append({**b, "source": "HIBP"})

    for c in nvd_results:
        epss = epss_scores.get(c["title"])
        if epss is not None:
            c["description"] = f"[EPSS: {epss}% exploit probability] " + c.get("description", "")
        all_events.append({**c, "source": "NVD"})

    for s in shodan_results:
        all_events.append({**s, "source": "Shodan"})

    for e in ch_results:
        all_events.append({**e, "source": "CompaniesHouse"})

    # Deduplicate against existing stored events
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

    score = min(
        sum(SEVERITY_WEIGHTS.get(e.get("severity", "LOW"), 2) for e in all_events),
        100.0
    )

    vendor.risk_score   = score
    vendor.last_scanned = datetime.utcnow()
    db.add(RiskScoreHistory(vendor_id=vendor.id, score=score))
    db.commit()

    all_stored = db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor.id).all()
    send_alert_email(vendor.name, vendor.domain, score, all_stored)

    print(f"[Scanner] {vendor.name} → Score: {score} | New events: {len(new_events)}")
    return score