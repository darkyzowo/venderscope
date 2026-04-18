import services.compliance_discovery as compliance


def test_compliance_discovery_finds_cert_on_linked_trust_page(monkeypatch):
    pages = {
        "https://vendor.com": """
            <html><body>
              <a href="/trust-center">Trust Center</a>
              <a href="/privacy">Privacy Policy</a>
            </body></html>
        """,
        "https://vendor.com/trust-center": """
            <html><body>
              <h1>Trust Center</h1>
              <p>We are certified to ISO 27001:2022 and maintain a SOC 2 Type II report.</p>
            </body></html>
        """,
        "https://vendor.com/privacy": """
            <html><body>
              <p>Our GDPR compliance posture is documented here.</p>
            </body></html>
        """,
    }

    monkeypatch.setattr(compliance, "_is_safe_domain", lambda domain: True)
    monkeypatch.setattr(compliance, "_fetch_page", lambda url, timeout=8: pages.get(url.rstrip("/")))
    monkeypatch.setattr(compliance, "_probe_doc_paths", lambda base, found: found)
    monkeypatch.setattr(compliance, "_find_docs_in_sitemap", lambda base, found: found)
    monkeypatch.setattr(compliance, "_check_trust_centre", lambda domain: {"url": "https://vendor.com/trust-center", "accessible": True})

    result = compliance.run_compliance_discovery("vendor.com", "Vendor", use_web_search=False)

    assert result["certifications"]["iso_27001"]["status"] == "found"
    assert result["certifications"]["soc2"]["status"] == "found"
    assert result["certifications"]["gdpr"]["status"] == "found"


def test_extract_relevant_links_stays_on_vendor_site():
    html = """
        <a href="/security">Security</a>
        <a href="https://vendor.com/legal/dpa">DPA</a>
        <a href="https://external.example/iso-cert">ISO cert</a>
    """

    links = compliance._extract_relevant_links(html, "https://vendor.com", "vendor.com")

    assert "https://vendor.com/security" in links
    assert "https://vendor.com/legal/dpa" in links
    assert all("external.example" not in link for link in links)
