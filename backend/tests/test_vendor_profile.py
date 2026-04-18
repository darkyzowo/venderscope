import services.vendor_profile as profile


def test_vendor_profile_discovers_same_site_icon_from_homepage(monkeypatch):
    html = """
        <html>
          <head>
            <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
            <link rel="apple-touch-icon" href="https://vendor.com/apple-touch-icon.png" sizes="180x180" />
            <meta name="description" content="Vendor profile description for testing." />
          </head>
          <body>SSO and MFA supported</body>
        </html>
    """

    monkeypatch.setattr(profile, "_is_safe_domain", lambda domain: True)
    monkeypatch.setattr(profile, "_fetch", lambda url, timeout=7: html if url == "https://vendor.com" else None)

    result = profile.discover_vendor_profile("vendor.com")

    assert result["logo_url"] == "https://vendor.com/apple-touch-icon.png"
    assert result["description"] == "Vendor profile description for testing."


def test_vendor_profile_ignores_third_party_icon_links(monkeypatch):
    html = """
        <html>
          <head>
            <link rel="icon" href="https://cdn.example.com/vendor-icon.png" sizes="64x64" />
          </head>
          <body></body>
        </html>
    """

    monkeypatch.setattr(profile, "_is_safe_domain", lambda domain: True)
    monkeypatch.setattr(profile, "_fetch", lambda url, timeout=7: html if url == "https://vendor.com" else None)

    result = profile.discover_vendor_profile("vendor.com")

    assert result["logo_url"] is None
