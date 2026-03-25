# backend/services/hibp.py
import requests
import time as _time

HIBP_URL = "https://haveibeenpwned.com/api/v3/breaches"

_HIBP_CACHE: dict = {"data": None, "fetched_at": 0.0}
_HIBP_CACHE_TTL = 3600  # 1 hour — HIBP breach list changes infrequently


def _domain_matches(breach_domain: str, vendor_domain: str) -> bool:
    """Exact domain match with www normalisation."""
    b = breach_domain.lower().lstrip("www.").strip()
    v = vendor_domain.lower().lstrip("www.").strip()
    return b == v


def _get_all_breaches() -> list:
    if _HIBP_CACHE["data"] is not None and _time.time() - _HIBP_CACHE["fetched_at"] < _HIBP_CACHE_TTL:
        return _HIBP_CACHE["data"]
    try:
        resp = requests.get(HIBP_URL, headers={"User-Agent": "VenderScope/1.0"}, timeout=10)
        resp.raise_for_status()
        result = resp.json()
        _HIBP_CACHE["data"] = result
        _HIBP_CACHE["fetched_at"] = _time.time()
        return result
    except Exception as e:
        print(f"[HIBP] Error fetching breach list: {e}")
        return []


def check_domain_breaches(domain: str) -> list[dict]:
    """
    Fetches all known breaches (cached 1hr) and filters for those
    affecting the given vendor domain. No API key needed.
    """
    all_breaches = _get_all_breaches()
    return [
        {
            "title": b["Name"],
            "description": f"Breach on {b['BreachDate']} exposed {b['PwnCount']:,} accounts. Data: {', '.join(b['DataClasses'][:4])}",
            "date": b["BreachDate"],
            "severity": classify_breach_severity(b["PwnCount"])
        }
        for b in all_breaches
        if _domain_matches(b.get("Domain", ""), domain)
    ]

def classify_breach_severity(pwn_count: int) -> str:
    if pwn_count > 10_000_000:
        return "CRITICAL"
    elif pwn_count > 1_000_000:
        return "HIGH"
    elif pwn_count > 100_000:
        return "MEDIUM"
    return "LOW"