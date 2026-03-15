from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from models import Vendor, RiskEvent, RiskScoreHistory
from services.hibp import check_domain_breaches
from services.nvd import check_vendor_cves
from services.companies_house import check_company_health
from services.shodan_service import check_shodan_exposure
from services.alerts import send_alert_email
from services.epss import get_epss_scores

SEVERITY_WEIGHTS = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 7, "LOW": 2}
CACHE_TTL_HOURS  = 24  # Skip external API calls if scanned within this window

def _is_cached(vendor: Vendor) -> bool:
    """Returns True if vendor was scanned recently enough to use cached data."""
    if not vendor.last_scanned:
        return False
    age = datetime.utcnow() - vendor.last_scanned
    return age < timedelta(hours=CACHE_TTL_HOURS)

def _compute_score(events: list) -> float:
    return min(sum(SEVERITY_WEIGHTS.get(e.get("severity", "LOW"), 2) for e in events), 100.0)

def run_full_scan(vendor: Vendor, db: Session, force: bool = False) -> float:
    """
    Orchestrates all intelligence sources for a vendor.
    Uses cached DB data if scanned within CACHE_TTL_HOURS unless force=True.
    """
    # ── Cache hit: return existing score instantly ──────────────────────────
    if not force and _is_cached(vendor):
        print(f"[Scanner] {vendor.name} — cache hit, returning stored score {vendor.risk_score}")
        return vendor.risk_score

    print(f"[Scanner] Scanning {vendor.name} ({vendor.domain})...")
    start = datetime.utcnow()

    # ── Fetch all sources concurrently ──────────────────────────────────────
    tasks = {
        "hibp":   (check_domain_breaches, vendor.domain),
        "nvd":    (check_vendor_cves,     vendor.name),
        "shodan": (check_shodan_exposure,  vendor.domain),
    }
    if vendor.company_number:
        tasks["ch"] = (check_company_health, vendor.company_number)

    results = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(fn, arg): key for key, (fn, arg) in tasks.items()}
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
            except Exception as e:
                print(f"[Scanner] {key} failed for {vendor.name}: {e}")
                results[key] = []

    # ── Assemble raw events ─────────────────────────────────────────────────
    all_events = []

    for b in results.get("hibp", []):
        all_events.append({**b, "source": "HIBP"})

    nvd_results = results.get("nvd", [])
    cve_ids     = [c["title"] for c in nvd_results if c["title"].startswith("CVE-")]
    epss_scores = get_epss_scores(cve_ids)
    for c in nvd_results:
        epss = epss_scores.get(c["title"])
        if epss is not None:
            c["description"] = f"[EPSS: {epss}% exploit probability] " + c.get("description", "")
        all_events.append({**c, "source": "NVD"})

    for s in results.get("shodan", []):
        all_events.append({**s, "source": "Shodan"})

    for e in results.get("ch", []):
        all_events.append({**e, "source": "CompaniesHouse"})

    # Deduplicate — match on CVE ID only (first word of title), ignoring EPSS prefix changes
    existing_titles = set()
    for e in db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor.id).all():
        existing_titles.add(e.title.split(' ')[0])

    new_events = [e for e in all_events if e["title"].split(' ')[0] not in existing_titles]

    for evt in new_events:
        db.add(RiskEvent(
            vendor_id   = vendor.id,
            source      = evt.get("source", "Unknown"),
            severity    = evt.get("severity", "LOW"),
            title       = evt["title"],
            description = evt.get("description", ""),
        ))

    # ── Score and persist ───────────────────────────────────────────────────
    score               = _compute_score(all_events)
    vendor.risk_score   = score
    vendor.last_scanned = datetime.utcnow()
    db.add(RiskScoreHistory(vendor_id=vendor.id, score=score))
    db.commit()

    # ── Alert if score crossed threshold ────────────────────────────────────
    all_stored = db.query(RiskEvent).filter(RiskEvent.vendor_id == vendor.id).all()
    send_alert_email(vendor.name, vendor.domain, score, all_stored)

    elapsed = (datetime.utcnow() - start).seconds
    print(f"[Scanner] {vendor.name} → {score} | +{len(new_events)} events | {elapsed}s")
    return score