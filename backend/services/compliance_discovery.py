import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

# SSRF protection — block internal/private IP ranges
BLOCKED_PATTERNS = [
    r"^localhost$",
    r"^127\.",
    r"^10\.",
    r"^172\.(1[6-9]|2[0-9]|3[01])\.",
    r"^192\.168\.",
    r"^169\.254\.",   # AWS metadata
    r"^0\.",
    r"^::1$",
]

HEADERS = {
    "User-Agent": "VenderScope/1.0 Compliance Discovery Bot (security research)"
}

# Document types to look for
DOC_PATTERNS = {
    "privacy_policy":  ["/privacy", "/privacy-policy", "/privacy_policy", "privacy"],
    "terms":           ["/terms", "/terms-of-service", "/terms-of-use", "/tos", "terms"],
    "security":        ["/security", "/security-policy", "/security.txt", "security"],
    "dpa":             ["/dpa", "/data-processing", "/data-processing-agreement", "dpa"],
    "cookie_policy":   ["/cookies", "/cookie-policy", "/cookie_policy", "cookies"],
}

# Trust centre patterns
TRUST_PATTERNS = [
    "trust.{domain}",
    "security.{domain}",
    "compliance.{domain}",
    "{domain}/trust",
    "{domain}/trust-center",
    "{domain}/security",
    "{domain}/compliance",
]

# Certification keywords to search for
CERT_KEYWORDS = {
    "iso_27001": [
        "iso 27001", "iso27001", "iso/iec 27001",
        "information security management", "isms certified"
    ],
    "soc2": [
        "soc 2", "soc2", "soc type 2", "soc type ii",
        "aicpa soc", "service organization control"
    ],
    "gdpr": [
        "gdpr compliant", "gdpr compliance", "general data protection",
        "data protection regulation"
    ],
    "cyber_essentials": [
        "cyber essentials", "cyber essentials plus"
    ],
    "pci_dss": [
        "pci dss", "pci-dss", "payment card industry"
    ],
}

# Security contact email prefixes to check
SECURITY_EMAIL_PREFIXES = ["security", "privacy", "dpo", "dpa", "compliance", "legal"]


def _is_safe_domain(domain: str) -> bool:
    """SSRF protection — block private/internal IP ranges."""
    clean = domain.replace("https://", "").replace("http://", "").split("/")[0]
    for pattern in BLOCKED_PATTERNS:
        if re.match(pattern, clean):
            return False
    return True


def _fetch_page(url: str, timeout: int = 8) -> str | None:
    """Fetch a page and return its text content, or None if unreachable."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout,
                            allow_redirects=True)
        if resp.status_code == 200:
            return resp.text
        return None
    except Exception:
        return None


def _find_doc_links(html: str, base_url: str) -> dict:
    """
    Scrapes a page's HTML to find links to compliance documents.
    Returns a dict of {doc_type: url}.
    """
    soup   = BeautifulSoup(html, "html.parser")
    found  = {}
    links  = soup.find_all("a", href=True)

    for link in links:
        href = link["href"].lower()
        text = link.get_text(strip=True).lower()
        full = urljoin(base_url, link["href"])

        for doc_type, patterns in DOC_PATTERNS.items():
            if doc_type in found:
                continue
            for pattern in patterns:
                if pattern in href or pattern in text:
                    found[doc_type] = full
                    break

    return found


def _check_trust_centre(domain: str) -> dict:
    """
    Checks common trust centre URL patterns.
    Returns {url, accessible} if found, else None.
    """
    base = domain.replace("https://", "").replace("http://", "").rstrip("/")
    candidates = []

    for pattern in TRUST_PATTERNS:
        url = pattern.format(domain=base)
        if not url.startswith("http"):
            url = f"https://{url}"
        candidates.append(url)

    for url in candidates:
        try:
            resp = requests.head(url, headers=HEADERS, timeout=6,
                                 allow_redirects=True)
            if resp.status_code in (200, 301, 302):
                # Check if publicly accessible or behind login
                body = _fetch_page(url, timeout=6)
                accessible = body is not None and len(body) > 500
                return {"url": url, "accessible": accessible}
        except Exception:
            continue

    return None


def _check_certifications(html: str, extra_pages: list[str]) -> dict:
    """
    Searches page content for certification mentions.
    Returns {cert_name: 'found' | 'not_found'}.
    """
    # Combine all page text
    full_text = html.lower()
    for page_html in extra_pages:
        if page_html:
            full_text += page_html.lower()

    results = {}
    for cert, keywords in CERT_KEYWORDS.items():
        found = any(kw in full_text for kw in keywords)
        results[cert] = "found" if found else "not_found"

    return results


def _find_security_contact(domain: str) -> str | None:
    """
    Returns the most likely security contact email for a domain.
    Checks security.txt first (RFC 9116), then falls back to common prefixes.
    """
    base = domain.replace("https://", "").replace("http://", "").rstrip("/")

    # Check security.txt (RFC 9116 standard)
    for path in ["/.well-known/security.txt", "/security.txt"]:
        content = _fetch_page(f"https://{base}{path}")
        if content:
            match = re.search(r"Contact:\s*(mailto:)?([^\s]+@[^\s]+)", content, re.IGNORECASE)
            if match:
                return match.group(2).strip()

    # Fall back to common prefixes
    for prefix in SECURITY_EMAIL_PREFIXES:
        return f"{prefix}@{base}"  # Return the most likely one

    return f"security@{base}"


def run_compliance_discovery(domain: str) -> dict:
    """
    Main entry point. Discovers compliance documents, trust centre,
    certifications and security contact for a vendor domain.
    """
    if not _is_safe_domain(domain):
        print(f"[Compliance] Blocked unsafe domain: {domain}")
        return {}

    base = domain.replace("https://", "").replace("http://", "").rstrip("/")
    home_url = f"https://{base}"

    print(f"[Compliance] Discovering compliance info for {base}...")

    # 1. Fetch homepage
    home_html = _fetch_page(home_url)
    if not home_html:
        # Try www prefix
        home_html = _fetch_page(f"https://www.{base}")
        if home_html:
            home_url = f"https://www.{base}"

    doc_links = {}
    if home_html:
        doc_links = _find_doc_links(home_html, home_url)

    # 2. Also check security page for certification mentions
    security_html = None
    if "security" in doc_links:
        security_html = _fetch_page(doc_links["security"])

    privacy_html = None
    if "privacy_policy" in doc_links:
        privacy_html = _fetch_page(doc_links["privacy_policy"])

    # 3. Certifications
    certifications = _check_certifications(
        home_html or "",
        [security_html, privacy_html]
    )

    # 4. Trust centre
    trust = _check_trust_centre(base)

    # 5. Security contact
    contact = _find_security_contact(base)

    result = {
        "documents":      doc_links,
        "trust_centre":   trust,
        "certifications": certifications,
        "security_contact": contact,
    }

    print(f"[Compliance] {base} → {len(doc_links)} docs, "
          f"trust centre: {'yes' if trust else 'no'}, "
          f"certs found: {sum(1 for v in certifications.values() if v == 'found')}")

    return result