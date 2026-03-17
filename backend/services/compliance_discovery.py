import re
import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# ── SSRF protection ────────────────────────────────────────────────────────────
BLOCKED_PATTERNS = [
    r"^localhost$", r"^127\.", r"^10\.",
    r"^172\.(1[6-9]|2[0-9]|3[01])\.",
    r"^192\.168\.", r"^169\.254\.", r"^0\.", r"^::1$",
]

HEADERS = {"User-Agent": "VenderScope/1.0 Compliance Discovery Bot (security research)"}

# ── Document link patterns ─────────────────────────────────────────────────────
DOC_PATTERNS = {
    "privacy_policy": ["/privacy", "/privacy-policy", "/privacy_policy", "privacy"],
    "terms":          ["/terms", "/terms-of-service", "/terms-of-use", "/tos", "terms"],
    "security":       ["/security", "/security-policy", "/security.txt", "security"],
    "cookie_policy":  ["/cookies", "/cookie-policy", "/cookie_policy", "cookies"],
}

# ── Trust centre URL patterns ──────────────────────────────────────────────────
TRUST_PATTERNS = [
    "trust.{domain}", "security.{domain}", "compliance.{domain}",
    "{domain}/trust", "{domain}/trust-center", "{domain}/trust-centre",
    "{domain}/security", "{domain}/compliance",
]

# ── Certification keyword sets (page scrape stage) ────────────────────────────
CERT_KEYWORDS = {
    "iso_27001":       ["iso 27001", "iso27001", "iso/iec 27001", "information security management", "isms certified"],
    "soc2":            ["soc 2", "soc2", "soc type 2", "soc type ii", "aicpa soc", "service organization control"],
    "gdpr":            ["gdpr compliant", "gdpr compliance", "general data protection", "data protection regulation"],
    "cyber_essentials":["cyber essentials", "cyber essentials plus"],
    "pci_dss":         ["pci dss", "pci-dss", "payment card industry"],
    "dpa":             ["data processing agreement", "data processing addendum", "dpa", "controller to processor", "sub-processor agreement", "article 28", "gdpr article 28"],
}

# ── Google search query templates (web fallback stage) ────────────────────────
CERT_SEARCH_QUERIES = {
    "iso_27001":        ["{name} ISO 27001 certified", "{domain} ISO 27001 certificate"],
    "soc2":             ["{name} SOC 2 report", "{domain} SOC 2 type II"],
    "gdpr":             ["{name} GDPR compliant", "{domain} GDPR compliance"],
    "cyber_essentials": ["{name} Cyber Essentials certified", "{domain} Cyber Essentials"],
    "pci_dss":          ["{name} PCI DSS compliant", "{domain} PCI DSS"],
    "dpa": [
        '"{name}" "data processing agreement"',
        '"{name}" "DPA" site:{domain}',
        "{name} data processing agreement GDPR",
        "{domain} data processing addendum",
    ],
}

# ── Credibility signals in search results ─────────────────────────────────────
# Results from these domains are treated as strong external evidence
CREDIBLE_DOMAINS = [
    "bsigroup.com", "schellman.com", "aicpa.org", "ukas.com",
    "iasme.co.uk", "ncsc.gov.uk", "pcisecuritystandards.org",
    "certified.iso.org", "tuvsud.com", "dnv.com",
]


def _is_safe_domain(domain: str) -> bool:
    clean = domain.replace("https://", "").replace("http://", "").split("/")[0]
    return not any(re.match(p, clean) for p in BLOCKED_PATTERNS)


def _fetch_page(url: str, timeout: int = 8) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        return r.text if r.status_code == 200 else None
    except Exception:
        return None


def _find_doc_links(html: str, base_url: str) -> dict:
    soup  = BeautifulSoup(html, "html.parser")
    found = {}
    for link in soup.find_all("a", href=True):
        href = link["href"].lower()
        text = link.get_text(strip=True).lower()
        full = urljoin(base_url, link["href"])
        for doc_type, patterns in DOC_PATTERNS.items():
            if doc_type in found:
                continue
            if any(p in href or p in text for p in patterns):
                found[doc_type] = full
    return found


def _check_trust_centre(domain: str) -> dict | None:
    base = domain.replace("https://", "").replace("http://", "").rstrip("/")
    for pattern in TRUST_PATTERNS:
        url = pattern.format(domain=base)
        if not url.startswith("http"):
            url = f"https://{url}"
        try:
            r = requests.head(url, headers=HEADERS, timeout=6, allow_redirects=True)
            if r.status_code in (200, 301, 302):
                body = _fetch_page(url, timeout=6)
                return {"url": url, "accessible": bool(body and len(body) > 500)}
        except Exception:
            continue
    return None


def _scrape_stage(full_text: str) -> dict:
    """
    Stage 1 — keyword search across all fetched page content.
    Returns {cert: 'found' | 'not_found'}.
    """
    results = {}
    for cert, keywords in CERT_KEYWORDS.items():
        results[cert] = "found" if any(kw in full_text for kw in keywords) else "not_found"
    return results


def _google_search(query: str) -> list[dict]:
    """
    Fires a single Google Custom Search query.
    Returns list of {title, link, snippet} or [] on failure.
    """
    api_key = os.getenv("GOOGLE_CSE_API_KEY")
    cse_id  = os.getenv("GOOGLE_CSE_ID")
    if not api_key or not cse_id:
        return []
    try:
        r = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={"key": api_key, "cx": cse_id, "q": query, "num": 5},
            timeout=8,
        )
        if r.status_code == 200:
            return r.json().get("items", [])
    except Exception:
        pass
    return []


def _result_is_credible(items: list[dict], cert_keywords: list[str]) -> dict | None:
    """
    Checks search result items for keyword matches.
    Prefers results from credible certification body domains.
    Returns the best matching item or None.
    """
    best = None
    for item in items:
        text = (item.get("title", "") + " " + item.get("snippet", "")).lower()
        link = item.get("link", "")
        if not any(kw in text for kw in cert_keywords):
            continue
        # Prefer credible body domains
        if any(d in link for d in CREDIBLE_DOMAINS):
            return item   # immediate return — best possible signal
        if best is None:
            best = item   # keep first keyword match as fallback
    return best


def _web_search_stage(vendor_name: str, domain: str, scrape_results: dict) -> dict:
    """
    Stage 2 — fires Google searches only for certs not found in scrape.
    Returns enriched results dict with source metadata.
    """
    base = domain.replace("https://", "").replace("http://", "").rstrip("/")
    enriched = {}

    for cert, status in scrape_results.items():
        if status == "found":
            enriched[cert] = {"status": "found", "source": "site"}
            continue

        # Only search if we have query templates for this cert
        queries = CERT_SEARCH_QUERIES.get(cert, [])
        match   = None

        for q_template in queries:
            query = q_template.format(name=vendor_name, domain=base)
            print(f"[Compliance] Web search: {query}")
            items = _google_search(query)
            match = _result_is_credible(items, CERT_KEYWORDS[cert])
            if match:
                break   # found evidence — no need to try next query

        if match:
            enriched[cert] = {
                "status": "found",
                "source": "external",
                "url":    match.get("link", ""),
                "title":  match.get("title", ""),
            }
        else:
            enriched[cert] = {"status": "not_found", "source": None}

    return enriched


def _find_security_contact(domain: str, scraped_pages: list[str]) -> dict | None:
    """
    1. Check security.txt (RFC 9116) — most authoritative source.
    2. Scrape already-fetched pages for email addresses matching known prefixes.
    3. Fall back to Google CSE search for a contact email on the vendor's site.
       Never fabricates or guesses — only returns confirmed findings.
    """
    base = domain.replace("https://", "").replace("http://", "").rstrip("/")

    # Stage 1 — security.txt
    for path in ["/.well-known/security.txt", "/security.txt"]:
        content = _fetch_page(f"https://{base}{path}")
        if content:
            match = re.search(r"Contact:\s*(mailto:)?([^\s]+@[^\s]+)", content, re.IGNORECASE)
            if match:
                return {"email": match.group(2).strip(), "verified": True, "source": "security.txt"}

    # Stage 2 — search pages we already fetched for matching email addresses
    combined = " ".join(filter(None, scraped_pages)).lower()
    for prefix in SECURITY_EMAIL_PREFIXES:
        pattern = rf"{prefix}@(?:www\.)?{re.escape(base)}"
        if re.search(pattern, combined, re.IGNORECASE):
            return {"email": f"{prefix}@{base}", "verified": True, "source": "site"}

    # Stage 3 — Google CSE fallback: search for a real contact email for this domain
    for prefix in SECURITY_EMAIL_PREFIXES:
        query = f'"{prefix}@{base}"'
        items = _google_search(query)
        for item in items:
            text = (item.get("title", "") + " " + item.get("snippet", "")).lower()
            if f"{prefix}@{base}" in text:
                return {"email": f"{prefix}@{base}", "verified": True, "source": "web_search"}

    return None


def run_compliance_discovery(domain: str, vendor_name: str = "") -> dict:
    """
    Main entry point. Two-stage cert discovery:
      1. Keyword scrape of vendor's own pages
      2. Google web search fallback for anything not found in stage 1
    """
    if not _is_safe_domain(domain):
        print(f"[Compliance] Blocked unsafe domain: {domain}")
        return {}

    base     = domain.replace("https://", "").replace("http://", "").rstrip("/")
    name     = vendor_name or base   # fall back to domain if no name provided
    home_url = f"https://{base}"

    print(f"[Compliance] Starting discovery for {name} ({base})...")

    # ── Fetch pages ──────────────────────────────────────────────────────────
    home_html = _fetch_page(home_url) or _fetch_page(f"https://www.{base}")
    if home_html:
        home_url = home_url  # already set

    doc_links    = _find_doc_links(home_html, home_url) if home_html else {}
    security_html = _fetch_page(doc_links["security"])       if "security"      in doc_links else None
    privacy_html  = _fetch_page(doc_links["privacy_policy"]) if "privacy_policy" in doc_links else None

    # Trust centre fetched before cert check so its HTML feeds into stage 1
    trust      = _check_trust_centre(base)
    trust_html = _fetch_page(trust["url"]) if trust else None

    # ── Stage 1: scrape ──────────────────────────────────────────────────────
    full_text    = " ".join(filter(None, [home_html, security_html, privacy_html, trust_html])).lower()
    scrape_results = _scrape_stage(full_text)

    # ── Stage 2: web search fallback ─────────────────────────────────────────
    certifications = _web_search_stage(name, base, scrape_results)

    # ── Security contact ─────────────────────────────────────────────────────
    contact = _find_security_contact(base)

    found_count = sum(1 for v in certifications.values() if v["status"] == "found")
    ext_count   = sum(1 for v in certifications.values() if v.get("source") == "external")
    print(f"[Compliance] Done — {len(doc_links)} docs, "
          f"{found_count} certs ({ext_count} via web search), "
          f"trust centre: {'yes' if trust else 'no'}, "
          f"contact: {'verified' if contact else 'none'}")

    return {
        "documents":        doc_links,
        "trust_centre":     trust,
        "certifications":   certifications,
        "security_contact": contact,
    }