import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from services.compliance_discovery import _is_safe_domain

HEADERS = {"User-Agent": "VenderScope/1.0 Vendor Profile Bot (security research)"}

# Auth patterns — ordered most-specific to least-specific so the first match wins
AUTH_PATTERNS = [
    ("SSO (SAML 2.0)",  ["saml 2.0", "saml2.0", "saml-based sso", "saml-based authentication"]),
    ("SAML",            ["saml"]),
    ("OpenID Connect",  ["openid connect", "oidc"]),
    ("SSO",             ["single sign-on", "single sign on"]),
    ("OAuth 2.0",       ["oauth 2.0", "oauth2.0"]),
    ("OAuth",           ["oauth"]),
    ("Passwordless",    ["passwordless", "magic link", "passkey", "webauthn", "fido2"]),
    ("Social Login",    [
        "sign in with google", "log in with google", "login with google",
        "continue with google", "sign in with github", "continue with github",
        "sign in with microsoft", "continue with microsoft",
        "google oauth", "github oauth",
    ]),
    ("Okta",            ["okta"]),
    ("Auth0",           ["auth0"]),
    ("Password-based",  [
        "email and password", "username and password", "email/password",
        "sign in with email", "log in with email",
    ]),
]

TWO_FA_KEYWORDS = [
    "two-factor", "two factor", "2fa", "2-fa",
    "mfa", "multi-factor", "multifactor",
    "totp", "authenticator app", "google authenticator", "authy",
    "sms verification", "sms code", "one-time password", "one-time code",
    "time-based one", "hardware key", "yubikey", "security key",
]

LOGIN_PATHS = [
    "/login", "/signin", "/sign-in",
    "/auth/login", "/users/sign_in", "/app/login",
]


def _fetch(url: str, timeout: int = 7) -> str | None:
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
                next_url = urljoin(current_url, location)
                hop_host = urlparse(next_url).netloc
                if not _is_safe_domain(hop_host):
                    return None
                current_url = next_url
                continue
            return None
        except Exception:
            return None
    return None


def _to_text(html: str) -> str:
    return BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower()


def _meta_description(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    for attr, val in [("property", "og:description"), ("name", "description")]:
        tag = soup.find("meta", attrs={attr: val})
        if tag:
            content = tag.get("content", "").strip()
            if len(content) > 20:
                return content
    return None


def _detect_auth(text: str) -> str | None:
    for label, keywords in AUTH_PATTERNS:
        if any(kw in text for kw in keywords):
            return label
    return None


def _detect_2fa(text: str) -> str | None:
    return "Yes" if any(kw in text for kw in TWO_FA_KEYWORDS) else None


def discover_vendor_profile(domain: str) -> dict:
    """
    Passively discovers three fields for a vendor:
      - description : 1-2 line summary from homepage meta tags
      - auth_method : e.g. "SSO (SAML 2.0)", "OAuth 2.0", "Password-based"
      - two_factor  : "Yes" or None (not detected — we never assert "No")

    Never raises — returns partial results on any failure.
    """
    base   = domain.replace("https://", "").replace("http://", "").rstrip("/")
    result = {"description": None, "auth_method": None, "two_factor": None}

    if not _is_safe_domain(base):
        print(f"[Profile] Blocked unsafe domain: {base}")
        return result
    try:
        home_html = _fetch(f"https://{base}") or _fetch(f"https://www.{base}")
        if not home_html:
            print(f"[Profile] Could not fetch homepage for {base}")
            return result

        result["description"] = _meta_description(home_html)
        home_text = _to_text(home_html)

        # Fetch login page — best source for auth method signals
        login_text = ""
        for path in LOGIN_PATHS:
            html = _fetch(f"https://{base}{path}", timeout=5)
            if html:
                login_text = _to_text(html)
                break

        # Security page — best source for 2FA signals
        sec_html  = _fetch(f"https://{base}/security", timeout=5)
        sec_text  = _to_text(sec_html) if sec_html else ""

        combined = home_text + " " + login_text + " " + sec_text

        result["auth_method"] = _detect_auth(combined)
        result["two_factor"]  = _detect_2fa(combined)

        print(f"[Profile] {base} → auth={result['auth_method']}, "
              f"2fa={result['two_factor']}, desc={'yes' if result['description'] else 'no'}")

    except Exception as e:
        print(f"[Profile] Error for {domain}: {e}")

    return result
