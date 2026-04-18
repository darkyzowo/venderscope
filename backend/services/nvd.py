import config  # Loads backend/.env once with process env precedence.
import requests
import os

NVD_API_KEY = os.getenv("NVD_API_KEY")
NVD_URL     = "https://services.nvd.nist.gov/rest/json/cves/2.0"

def check_vendor_cves(vendor_name: str) -> list[dict]:
    params  = {"keywordSearch": vendor_name, "resultsPerPage": 10, "startIndex": 0}
    headers = {"apiKey": NVD_API_KEY} if NVD_API_KEY else {}

    try:
        resp = requests.get(NVD_URL, params=params, headers=headers, timeout=12)
        resp.raise_for_status()
        results = []
        for item in resp.json().get("vulnerabilities", []):
            cve     = item.get("cve", {})
            cve_id  = cve.get("id", "Unknown")
            desc    = next((d["value"] for d in cve.get("descriptions", []) if d["lang"] == "en"), "No description")
            score, severity = _extract_cvss(cve.get("metrics", {}))
            results.append({"title": cve_id, "description": desc[:300], "severity": severity, "cvss_score": score})
        print(f"[NVD] {vendor_name} → {len(results)} CVEs")
        return results
    except Exception as e:
        print(f"[NVD] Error for {vendor_name}: {e}")
        return []

def _extract_cvss(metrics: dict) -> tuple[float, str]:
    for key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
        if metrics.get(key):
            d = metrics[key][0].get("cvssData", {})
            return d.get("baseScore", 0.0), d.get("baseSeverity", "LOW")
    return 0.0, "LOW"
