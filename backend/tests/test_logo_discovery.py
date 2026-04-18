import json

import services.logo_discovery as logos


def test_discover_logo_candidates_prefers_same_site_metadata(monkeypatch):
    class FakeResponse:
        def __init__(self, url, status_code=200, text="", headers=None):
            self.url = url
            self.status_code = status_code
            self._text = text
            self.headers = headers or {"Content-Type": "text/html"}
            self.raw = None

        @property
        def text(self):
            return self._text

        def close(self):
            return None

    html = """
        <html>
          <head>
            <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
          </head>
        </html>
    """

    monkeypatch.setattr(logos, "_is_safe_domain", lambda domain: True)
    monkeypatch.setattr(
        logos,
        "_safe_get",
        lambda url, timeout=6: FakeResponse("https://vendor.com", text=html) if url == "https://vendor.com" else None,
    )

    candidates = logos.discover_logo_candidates("vendor.com")

    assert candidates[0] == "https://vendor.com/favicon-32x32.png"


def test_discover_logo_candidates_adds_manifest_icons(monkeypatch):
    class FakeResponse:
        def __init__(self, url, status_code=200, text="", headers=None):
            self.url = url
            self.status_code = status_code
            self._text = text
            self.headers = headers or {"Content-Type": "text/html"}
            self.raw = None

        @property
        def text(self):
            return self._text

        def close(self):
            return None

    html = '<html><head><link rel="manifest" href="/site.webmanifest" /></head></html>'
    manifest = json.dumps({
        "icons": [
            {"src": "/android-chrome-192x192.png", "sizes": "192x192"},
        ]
    })

    def fake_get(url, timeout=6):
        if url == "https://vendor.com":
            return FakeResponse("https://vendor.com", text=html)
        if url == "https://vendor.com/site.webmanifest":
            return FakeResponse("https://vendor.com/site.webmanifest", text=manifest, headers={"Content-Type": "application/manifest+json"})
        return None

    monkeypatch.setattr(logos, "_is_safe_domain", lambda domain: True)
    monkeypatch.setattr(logos, "_safe_get", fake_get)

    candidates = logos.discover_logo_candidates("vendor.com")

    assert "https://vendor.com/android-chrome-192x192.png" in candidates


def test_discover_logo_candidates_falls_back_to_same_site_logo_image(monkeypatch):
    class FakeResponse:
        def __init__(self, url, status_code=200, text="", headers=None):
            self.url = url
            self.status_code = status_code
            self._text = text
            self.headers = headers or {"Content-Type": "text/html"}
            self.raw = None

        @property
        def text(self):
            return self._text

        def close(self):
            return None

    html = """
        <html>
          <body>
            <header>
              <img src="/assets/vanta-wordmark.svg" alt="Vanta logo" width="160" height="36" />
              <img src="/assets/hero-graphic.png" alt="Hero graphic" width="800" height="420" />
            </header>
          </body>
        </html>
    """

    monkeypatch.setattr(logos, "_is_safe_domain", lambda domain: True)
    monkeypatch.setattr(
        logos,
        "_safe_get",
        lambda url, timeout=6: FakeResponse("https://vendor.com", text=html) if url == "https://vendor.com" else None,
    )

    candidates = logos.discover_logo_candidates("vendor.com")

    assert candidates[0] == "https://vendor.com/assets/vanta-wordmark.svg"
