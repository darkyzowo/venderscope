# backend/services/nvd.py
import requests
import os
from dotenv import load_dotenv

load_dotenv()

NVD_API_KEY = os.getenv("NVD_API_KEY")
NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

def check_vendor_cves(vendor_name: str) -> list[dict]:
    """
    Searches NVD for CVEs related to the vendor name.
    Returns a list of recent, relevant vulnerabilities.
    """
    params = {
        "keywordSearch": vendor_name,
        "resultsPerPage": 10,
        "startIndex": 0,
    }
    headers = {}
    if NVD_API_KEY:
        headers["apiKey"] = NVD_API_KEY

    try:
        resp = requests.get(NVD_URL, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        cves = data.get("vulnerabilities", [])

        results = []
        for item in cves:
            cve = item.get("cve", {})
            cve_id = cve.get("id", "Unknown")
            descs = cve.get("descriptions", [])
            desc = next((d["value"] for d in descs if d["lang"] == "en"), "No description")
            metrics = cve.get("metrics", {})
            score, severity = extract_cvss(metrics)

            results.append({
                "title": cve_id,
                "description": desc[:300],
                "severity": severity,
                "cvss_score": score
            })
        return results
    except Exception as e:
        print(f"[NVD] Error checking {vendor_name}: {e}")
        return []

def extract_cvss(metrics: dict) -> tuple[float, str]:
    """Pull CVSS score from whichever metric version is available."""
    for key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
        if key in metrics and metrics[key]:
            data = metrics[key][0].get("cvssData", {})
            score = data.get("baseScore", 0.0)
            severity = data.get("baseSeverity", "LOW")
            return score, severity
    return 0.0, "LOW"