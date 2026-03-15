import re
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from models import Vendor, RiskEvent, RiskScoreHistory
from services.hibp import check_domain_breaches
from services.nvd import check_vendor_cves
from services.companies_house import check_company_health
from services.shodan_service import check_shodan_exposure
from services.alerts import send_alert_email

# Severity weights for scoring
SEVERITY_WEIGHTS = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 7, "LOW": 2}
CACHE_TTL_HOURS  = 24

def _is_cached(vendor: Vendor) -> bool:
    if not vendor.last_scanned:
        return False
    return (datetime.utcnow() - vendor.last_scanned) < timedelta(hours=CACHE_TTL_HOURS)

def _compute_score(events: list) -> float:
    """
    Weighted average of top 5 events + count multiplier.
    Prevents everything hitting 100 with many low-severity events.
    """
    if not events:
        return 0.0
    sev_map   = {"CRITICAL": 100, "HIGH": 70, "MEDIUM": 40, "LOW": 15}
    raw       = sorted([sev_map.get(e.get("severity", "LOW"), 15) for e in events], reverse=True)
    top5_avg  = sum(raw[:5]) / min(len(raw), 5)
    count_mul = min(1.0 + (len(events) - 1) * 0.04, 1.4)
    return min(round(top5_avg * count_mul, 1), 100.0)

def run_full_scan(vendor: Vendor, db: Session, force: bool = False) -> float:
    # Cache hit — return instantly
    if not force and _is_cached(vendor):
        print(f"[Scanner] {vendor.name} — cache hit ({vendor.risk_score})")
        return vendor.risk_score

    print(f"[Scanner] Scanning {vendor.name}...")
    start = datetime.utcnow()

    # Run all sources concurrently with a shared timeout
    tasks = {
        "hibp":   (check_domain_breaches, vendor.domain),
        "nvd":    (check_vendor_cves,     vendor.name),
        "shodan": (check_shodan_exposure,  vendor.domain),
    }
    if vendor.company_number:
        tasks["ch"] = (check_company_health, vendor.company_number)

    raw = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(fn, arg): key for key, (fn, arg) in tasks.items()}
        for f in as_completed(futures, timeout=30):
            key = futures[f]
            try:
                raw[key] = f.result()
            except Exception as e:
                print(f"[Scanner] {key} failed: {e}")
                raw[key] = []

    # Assemble all events
    all_events = []
    for b in raw.get("hibp",   []): all_events.append({**b, "source": "HIBP"})
    for c in raw.get("nvd",    []): all_events.append({**c, "source": "NVD"})
    for s in raw.get("shodan", []): all_events.append({**s, "source": "Shodan"})
    for e in raw.get("ch",     []): all_events.append({**e, "source": "CompaniesHouse"})

    # Deduplicate against DB — match on CVE ID prefix only
    stored = {e.title.split()[0] for e in
              db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor.id).all()}
    new_events = [e for e in all_events if e["title"].split()[0] not in stored]

    for evt in new_events:
        db.add(RiskEvent(
            vendor_id   = vendor.id,
            source      = evt.get("source", "Unknown"),
            severity    = evt.get("severity", "LOW"),
            title       = evt["title"],
            description = evt.get("description", ""),
        ))

    score               = _compute_score(all_events)
    vendor.risk_score   = score
    vendor.last_scanned = datetime.utcnow()
    db.add(RiskScoreHistory(vendor_id=vendor.id, score=score))
    db.commit()

    all_stored = db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor.id).all()
    send_alert_email(vendor.name, vendor.domain, score, all_stored)

    elapsed = (datetime.utcnow() - start).seconds
    print(f"[Scanner] {vendor.name} → {score} | +{len(new_events)} new events | {elapsed}s")
    return score