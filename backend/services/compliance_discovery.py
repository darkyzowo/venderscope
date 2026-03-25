import re
import os
import socket
import ipaddress
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote, urlparse

# ── SSRF protection ────────────────────────────────────────────────────────────
BLOCKED_PATTERNS = [
    r"^localhost$", r"^127\.", r"^10\.",
    r"^172\.(1[6-9]|2[0-9]|3[01])\.",
    r"^192\.168\.", r"^169\.254\.", r"^0\.", r"^::1$",
]

# Cloud metadata endpoints not covered by the regex blocklist above
BLOCKED_HOSTNAMES = {
    "metadata.google.internal",    # GCP metadata
    "metadata.azure.com",          # Azure metadata (hostname variant)
    "100.100.100.200",             # Alibaba Cloud metadata
    "0.0.0.0",
}

HEADERS = {"User-Agent": "VenderScope/1.0 Compliance Discovery Bot (security research)"}

# ── Document link patterns ─────────────────────────────────────────────────────
DOC_PATTERNS = {
    "privacy_policy": [
        "/privacy", "/privacy-policy", "/privacy_policy", "/legal/privacy",
        "/legal/privacy-policy", "/en/privacy", "/data-protection", "/gdpr",
        "/privacy-notice", "privacy",
    ],
    "terms": [
        "/terms", "/terms-of-service", "/terms-of-use", "/tos",
        "/legal/terms", "/legal/terms-of-service", "/en/terms", "terms",
    ],
    "security": [
        "/security", "/security-policy", "/security.txt", "/legal/security",
        "/vulnerability-disclosure", "security",
    ],
    "cookie_policy": ["/cookies", "/cookie-policy", "/cookie_policy", "cookies"],
}

# Paths probed directly when link extraction finds nothing for a doc type.
# HEAD request only — no body fetched until a 200 is confirmed.
DOC_PROBE_PATHS = {
    "privacy_policy": [
        "/privacy", "/privacy-policy", "/privacy_policy", "/legal/privacy",
        "/legal/privacy-policy", "/en/privacy", "/data-protection", "/gdpr",
        "/privacy-notice", "/legal",
    ],
    "terms": [
        "/terms", "/terms-of-service", "/terms-of-use", "/tos",
        "/legal/terms", "/legal/terms-of-service", "/en/terms",
    ],
    "security": [
        "/security", "/security-policy", "/legal/security",
        "/vulnerability-disclosure",
    ],
    "cookie_policy": ["/cookies", "/cookie-policy", "/cookie_policy"],
}

# ── Trust centre URL patterns ──────────────────────────────────────────────────
TRUST_PATTERNS = [
    "trust.{domain}", "security.{domain}", "compliance.{domain}",
    "{domain}/trust", "{domain}/trust-center", "{domain}/trust-centre",
    "{domain}/security", "{domain}/compliance",
]

# ── Certification keyword sets (page scrape stage) ────────────────────────────
CERT_KEYWORDS = {
    "iso_27001": [
        "iso 27001", "iso27001", "iso/iec 27001", "information security management",
        "isms certified", "certified to iso 27001", "iso 27001:2022", "iso/iec 27001:2022",
    ],
    "soc2": [
        "soc 2", "soc2", "soc type 2", "soc type ii", "aicpa soc",
        "service organization control", "soc 2 type 2", "soc ii",
        "aicpa trust", "trust services criteria",
    ],
    "gdpr": [
        "gdpr compliant", "gdpr compliance", "general data protection",
        "data protection regulation", "uk gdpr", "data controller", "lawful basis",
    ],
    "cyber_essentials": ["cyber essentials", "cyber essentials plus"],
    "pci_dss":          ["pci dss", "pci-dss", "payment card industry"],
    "dpa": [
        "data processing agreement", "data processing addendum", "dpa",
        "controller to processor", "sub-processor agreement",
        "article 28", "gdpr article 28",
    ],
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

# ── Third-party attribution patterns ─────────────────────────────────────────
# Matches sentences where a cert keyword is attributed to the vendor's infra/
# suppliers rather than the vendor itself.  Used to detect "our data centres
# are ISO 27001 certified" vs "we hold ISO 27001 certification".
THIRD_PARTY_PATTERNS = [
    # "third-party / third parties ... certified / cert keyword" (100-char clause limit)
    r"third[- ]?part(?:y|ies)\b.{0,100}\b(iso.?27001|soc\s*2|pci|cyber\s*essentials|certified)",
    # "infrastructure / data centre / cloud provider ... certified"
    r"\b(infrastructure|data[- ]?cent(?:er|re)|hosting\s+provider|cloud\s+provider)\b.{0,150}\b(certified|iso.?27001|soc\s*2|pci)",
    # "partners / providers / vendors are certified"
    r"\b(partners?|providers?|vendors?|suppliers?)\s+(are|is|that\s+are|which\s+are|who\s+are)\b.{0,150}\b(certified|iso.?27001|soc\s*2|pci)",
    # cert keyword then "infrastructure / partner / provider" in same window
    r"\b(iso.?27001|soc\s*2|pci\s*dss|cyber\s*essentials)\b.{0,150}\b(infrastructure|data[- ]?cent(?:er|re)|hosting|cloud\s+provider|partner|vendor)\b",
    # "relies on / hosted by / powered by ... certified"
    r"\b(relies?\s+on|built\s+on|powered\s+by|operated\s+by|hosted\s+by|runs?\s+on)\b.{0,150}\b(certified|iso.?27001|soc\s*2|pci)\b",
    # "all of the third parties ... [cert]" — cert keyword required in same clause
    r"\ball\s+of\s+(the\s+)?(our\s+)?third[- ]?part(?:y|ies)\b.{0,150}\b(certified|iso.?27001|soc\s*2|pci|cyber\s*essentials)",
    # "core infrastructure" near cert keyword
    r"\bcore\s+infrastructure\b.{0,100}\b(iso.?27001|soc\s*2|certified)\b",
]

# ── Credible certification body domains ───────────────────────────────────────
CREDIBLE_DOMAINS = [
    "bsigroup.com", "schellman.com", "aicpa.org", "ukas.com",
    "iasme.co.uk", "ncsc.gov.uk", "pcisecuritystandards.org",
    "certified.iso.org", "tuvsud.com", "dnv.com",
]

# ── Security contact email prefixes ───────────────────────────────────────────
SECURITY_EMAIL_PREFIXES = ["security", "privacy", "dpo", "compliance", "legal", "infosec", "gdpr"]


def _is_safe_domain(domain: str) -> bool:
    clean = domain.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
    # URL-decode to prevent bypass via 127%2E0%2E0%2E1
    clean = unquote(clean)

    # Check cloud metadata endpoints not covered by regex patterns
    if clean.lower() in BLOCKED_HOSTNAMES:
        return False

    # Check against regex blocklist
    if any(re.match(p, clean) for p in BLOCKED_PATTERNS):
        return False

    # Check for decimal/hex/octal IP notation (e.g. 2130706433 → 127.0.0.1)
    try:
        ip_obj = ipaddress.ip_address(int(clean))
        if ip_obj.is_private or ip_obj.is_loopback:
            return False
    except (ValueError, TypeError):
        pass  # Not a numeric IP, continue to DNS resolution

    # Resolve DNS and check the resolved IP — prevents DNS rebinding attacks
    try:
        resolved_ip = socket.gethostbyname(clean)
        try:
            ip_obj = ipaddress.ip_address(resolved_ip)
            # ipaddress handles is_private, is_loopback, is_link_local natively
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                return False
            # Block IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 etc)
            if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
                if ip_obj.ipv4_mapped.is_private or ip_obj.ipv4_mapped.is_loopback:
                    return False
        except ValueError:
            return False  # Unparseable IP → block
    except socket.gaierror:
        return False

    return True


def _fetch_page(url: str, timeout: int = 8) -> str | None:
    max_hops = 3
    current_url = url
    for _ in range(max_hops):
        try:
            r = requests.get(current_url, headers=HEADERS, timeout=timeout, allow_redirects=False)
            if r.status_code == 200:
                return r.text
            if r.status_code in (301, 302, 303, 307, 308):
                location = r.headers.get("Location", "")
                if not location:
                    return None
                hop_host = urlparse(location).netloc or location
                if not _is_safe_domain(hop_host):
                    return None
                current_url = location
                continue
            return None
        except Exception:
            return None
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


def _probe_doc_paths(base: str, found: dict) -> dict:
    """
    Direct-path fallback: for any doc type not found by link extraction,
    probe known paths with a HEAD request and take the first 200 response.
    """
    result = dict(found)
    for doc_type, paths in DOC_PROBE_PATHS.items():
        if doc_type in result:
            continue
        for path in paths:
            url = f"https://{base}{path}"
            try:
                r = requests.head(url, headers=HEADERS, timeout=5, allow_redirects=True)
                if r.status_code == 200:
                    result[doc_type] = url
                    break
            except Exception:
                continue
    return result


def _find_docs_in_sitemap(base: str, found: dict) -> dict:
    """
    Parse sitemap.xml / sitemap_index.xml for missing doc type URLs.
    Only fills gaps — does not overwrite already-found entries.
    """
    result = dict(found)
    for path in ["/sitemap.xml", "/sitemap_index.xml"]:
        if len(result) == len(DOC_PATTERNS):
            break
        content = _fetch_page(f"https://{base}{path}", timeout=8)
        if not content:
            continue
        urls = re.findall(r"<loc>(https?://[^<]+)</loc>", content)
        for u in urls:
            u_lower = u.lower()
            for doc_type, patterns in DOC_PATTERNS.items():
                if doc_type in result:
                    continue
                if any(p.lstrip("/") in u_lower for p in patterns if p.startswith("/")):
                    result[doc_type] = u
    return result


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


def _is_third_party_attribution(full_text: str, keyword: str) -> bool:
    """
    Returns True when every text segment containing `keyword` attributes the cert
    to the vendor's infrastructure/suppliers rather than the vendor itself.

    Splits on HTML tags AND sentence-ending punctuation so adjacent list items /
    paragraphs never bleed into each other's pattern check.  A ±N char window
    was unreliable when two cert mentions sat in adjacent <li> elements.

    Only returns True when third-party evidence exists and NO direct evidence does,
    so "we are ISO 27001 certified AND our data centres are ISO 27001 certified"
    still resolves to found (direct evidence wins).
    """
    # Split raw HTML into isolated text segments on tags and sentence boundaries
    segments = [
        s.strip() for s in re.split(r'<[^>]+>|[.!?\n]', full_text)
        if keyword in s and len(s.strip()) > 15
    ]
    if not segments:
        return False

    has_direct = False
    has_third_party = False

    for seg in segments:
        if any(re.search(p, seg, re.IGNORECASE) for p in THIRD_PARTY_PATTERNS):
            has_third_party = True
        else:
            has_direct = True

    return has_third_party and not has_direct


def _scrape_stage(full_text: str) -> dict:
    """Stage 1 — keyword search across all fetched page content."""
    results = {}
    for cert, keywords in CERT_KEYWORDS.items():
        matched_kw = next((kw for kw in keywords if kw in full_text), None)
        if matched_kw is None:
            results[cert] = "not_found"
        elif _is_third_party_attribution(full_text, matched_kw):
            results[cert] = "third_party"
        else:
            results[cert] = "found"
    return results


def _google_search(query: str) -> list[dict]:
    """Fires a single Google Custom Search query. Returns [] on failure or missing keys."""
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
    """Returns the best matching search result item, preferring credible body domains."""
    best = None
    for item in items:
        text = (item.get("title", "") + " " + item.get("snippet", "")).lower()
        link = item.get("link", "")
        if not any(kw in text for kw in cert_keywords):
            continue
        if any(d in link for d in CREDIBLE_DOMAINS):
            return item
        if best is None:
            best = item
    return best


def _web_search_stage(vendor_name: str, domain: str, scrape_results: dict) -> dict:
    """
    Stage 2 — Google search fallback.
    - "found"       → already confirmed on-site, skip search.
    - "third_party" → run search to try to find direct cert evidence; if search
                      also only surfaces third-party attribution, preserve that status.
    - "not_found"   → run search as before; apply attribution check to snippets.
    """
    base     = domain.replace("https://", "").replace("http://", "").rstrip("/")
    enriched = {}

    for cert, status in scrape_results.items():
        if status == "found":
            enriched[cert] = {"status": "found", "source": "site"}
            continue

        queries = CERT_SEARCH_QUERIES.get(cert, [])
        match   = None
        for q_template in queries:
            query = q_template.format(name=vendor_name, domain=base)
            print(f"[Compliance] Web search: {query}")
            items = _google_search(query)
            match = _result_is_credible(items, CERT_KEYWORDS[cert])
            if match:
                break

        if match:
            # Attribution-check the snippet before calling it "found"
            snippet    = (match.get("title", "") + " " + match.get("snippet", "")).lower()
            kw_in_snip = next((kw for kw in CERT_KEYWORDS[cert] if kw in snippet), None)
            is_tp      = (
                kw_in_snip is not None
                and any(re.search(p, snippet, re.IGNORECASE) for p in THIRD_PARTY_PATTERNS)
            )
            enriched[cert] = {
                "status": "third_party" if is_tp else "found",
                "source": "external",
                "url":    match.get("link", ""),
                "title":  match.get("title", ""),
            }
        else:
            # No web evidence found — preserve third_party from scrape if that's what we had
            enriched[cert] = {
                "status": status if status == "third_party" else "not_found",
                "source": "site" if status == "third_party" else None,
            }

    return enriched


def _find_security_contact(domain: str, scraped_pages: list[str], use_web_search: bool = True) -> dict | None:
    """
    1. Check security.txt (RFC 9116) — most authoritative.
    2. Scrape already-fetched pages for emails matching known prefixes.
    3. Google CSE fallback (only if use_web_search=True).
    Never fabricates — only returns confirmed findings.
    """
    base = domain.replace("https://", "").replace("http://", "").rstrip("/")

    # Stage 1 — security.txt
    for path in ["/.well-known/security.txt", "/security.txt"]:
        content = _fetch_page(f"https://{base}{path}")
        if content:
            match = re.search(r"Contact:\s*(mailto:)?([^\s]+@[^\s]+)", content, re.IGNORECASE)
            if match:
                return {"email": match.group(2).strip(), "verified": True, "source": "security.txt"}

    # Stage 2 — scrape pages already fetched
    combined = " ".join(filter(None, scraped_pages)).lower()
    for prefix in SECURITY_EMAIL_PREFIXES:
        pattern = rf"{prefix}@(?:www\.)?{re.escape(base)}"
        if re.search(pattern, combined, re.IGNORECASE):
            return {"email": f"{prefix}@{base}", "verified": True, "source": "site"}

    # Stage 3 — Google CSE fallback (skipped if quota exhausted)
    if use_web_search:
        for prefix in SECURITY_EMAIL_PREFIXES:
            query = f'"{prefix}@{base}"'
            items = _google_search(query)
            for item in items:
                text = (item.get("title", "") + " " + item.get("snippet", "")).lower()
                if f"{prefix}@{base}" in text:
                    return {"email": f"{prefix}@{base}", "verified": True, "source": "web_search"}

    return None


def run_compliance_discovery(domain: str, vendor_name: str = "", use_web_search: bool = True) -> dict:
    """
    Main entry point. Two-stage cert discovery:
      1. Keyword scrape of vendor's own pages (always runs)
      2. Google CSE web search fallback (skipped when use_web_search=False / quota exhausted)
    """
    if not _is_safe_domain(domain):
        print(f"[Compliance] Blocked unsafe domain: {domain}")
        return {}

    base     = domain.replace("https://", "").replace("http://", "").rstrip("/")
    name     = vendor_name or base
    home_url = f"https://{base}"

    print(f"[Compliance] Starting {'Full Intelligence' if use_web_search else 'Standard'} "
          f"discovery for {name} ({base})...")

    # ── Fetch pages ──────────────────────────────────────────────────────────
    home_html    = _fetch_page(home_url) or _fetch_page(f"https://www.{base}")
    doc_links    = _find_doc_links(home_html, home_url) if home_html else {}

    # Fallback 1: probe known paths directly for any missing doc types
    if len(doc_links) < len(DOC_PATTERNS):
        doc_links = _probe_doc_paths(base, doc_links)

    # Fallback 2: sitemap.xml for any still-missing doc types
    if len(doc_links) < len(DOC_PATTERNS):
        doc_links = _find_docs_in_sitemap(base, doc_links)

    security_html = _fetch_page(doc_links["security"])        if "security"       in doc_links else None
    privacy_html  = _fetch_page(doc_links["privacy_policy"])  if "privacy_policy" in doc_links else None

    # Trust centre fetched before cert check so its HTML feeds into stage 1
    trust      = _check_trust_centre(base)
    trust_html = _fetch_page(trust["url"]) if trust else None

    # ── Stage 1: scrape ──────────────────────────────────────────────────────
    full_text      = " ".join(filter(None, [home_html, security_html, privacy_html, trust_html])).lower()
    scrape_results = _scrape_stage(full_text)

    # ── Stage 2: web search fallback (skipped if quota exhausted) ────────────
    if use_web_search:
        certifications = _web_search_stage(name, base, scrape_results)
    else:
        print(f"[Compliance] Standard Scan — skipping web search for {base}")
        certifications = {
            k: {"status": v, "source": "site" if v in ("found", "third_party") else None}
            for k, v in scrape_results.items()
        }

    # ── Security contact ─────────────────────────────────────────────────────
    scraped_pages = [home_html, security_html, privacy_html, trust_html]
    contact       = _find_security_contact(base, scraped_pages, use_web_search)

    found_count = sum(1 for v in certifications.values() if v["status"] == "found")
    tp_count    = sum(1 for v in certifications.values() if v["status"] == "third_party")
    ext_count   = sum(1 for v in certifications.values() if v.get("source") == "external")
    print(f"[Compliance] Done — {len(doc_links)} docs, "
          f"{found_count} certs direct, {tp_count} via infra partners "
          f"({ext_count} via web search), "
          f"trust centre: {'yes' if trust else 'no'}, "
          f"contact: {'verified' if contact else 'none'}")

    return {
        "documents":        doc_links,
        "trust_centre":     trust,
        "certifications":   certifications,
        "security_contact": contact,
    }