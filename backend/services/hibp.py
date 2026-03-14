# backend/services/hibp.py
import requests

HIBP_URL = "https://haveibeenpwned.com/api/v3/breaches"

def check_domain_breaches(domain: str) -> list[dict]:
    """
    Fetches all known breaches and filters for those
    affecting the given vendor domain. No API key needed.
    """
    try:
        resp = requests.get(HIBP_URL, headers={"User-Agent": "VenderScope/1.0"}, timeout=10)
        resp.raise_for_status()
        all_breaches = resp.json()

        # Filter breaches where the domain matches
        matched = [
            {
                "title": b["Name"],
                "description": f"Breach on {b['BreachDate']} exposed {b['PwnCount']:,} accounts. Data: {', '.join(b['DataClasses'][:4])}",
                "date": b["BreachDate"],
                "severity": classify_breach_severity(b["PwnCount"])
            }
            for b in all_breaches
            if domain.lower() in b.get("Domain", "").lower()
        ]
        return matched
    except Exception as e:
        print(f"[HIBP] Error checking {domain}: {e}")
        return []

def classify_breach_severity(pwn_count: int) -> str:
    if pwn_count > 10_000_000:
        return "CRITICAL"
    elif pwn_count > 1_000_000:
        return "HIGH"
    elif pwn_count > 100_000:
        return "MEDIUM"
    return "LOW"