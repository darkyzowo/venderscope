import requests

EPSS_URL = "https://api.first.org/data/v1/epss"

def get_epss_scores(cve_ids: list[str]) -> dict[str, float]:
    """
    Fetches EPSS (Exploit Prediction Scoring System) scores for a list of CVE IDs.
    Returns a dict of {cve_id: epss_score} where score is 0.0–1.0 (probability of exploitation).
    Free API, no key needed.
    """
    if not cve_ids:
        return {}

    try:
        # API accepts comma-separated CVE IDs
        params = {"cve": ",".join(cve_ids)}
        resp = requests.get(EPSS_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        scores = {}
        for item in data.get("data", []):
            cve_id = item.get("cve")
            epss   = float(item.get("epss", 0.0))
            if cve_id:
                scores[cve_id] = round(epss * 100, 2)  # convert to percentage

        print(f"[EPSS] Fetched scores for {len(scores)}/{len(cve_ids)} CVEs")
        return scores

    except Exception as e:
        print(f"[EPSS] Error fetching scores: {e}")
        return {}