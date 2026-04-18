# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| v3.5 (current) | ✅ |
| v3.1 | ✅ Security patches only |
| v3.0 | ❌ Upgrade to v3.5 |
| v2.x | ❌ No longer maintained |
| v1.x | ❌ No longer maintained |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in VenderScope, please report it responsibly:

**Email:** syedzrk1000@gmail.com
**Subject line:** `[SECURITY] VenderScope Vulnerability Report`
**PGP:** Available on request

### What to include

- A clear description of the vulnerability
- Steps to reproduce (proof of concept if possible)
- The potential impact
- Any suggested remediation

### What to expect

- **Acknowledgement:** Within 48 hours
- **Initial assessment:** Within 5 business days
- **Resolution target:** Within 30 days for critical issues, 90 days for others
- **Credit:** We will credit researchers in our release notes unless you prefer to remain anonymous

We ask that you:
- Give us reasonable time to investigate and fix before public disclosure
- Avoid accessing or modifying other users' data during research
- Do not perform denial-of-service testing

---

## Our Security Practices

### Authentication
- Passwords hashed with bcrypt (minimum 12 rounds)
- JWT access tokens are short-lived (15 minutes) and stored in memory only — never in localStorage
- Refresh tokens are 7-day single-use tokens stored in httpOnly, Secure, SameSite=None cookies — inaccessible to JavaScript
- The refresh cookie is treated as a **strictly necessary security cookie**; optional-cookie consent does not disable authentication
- Used refresh tokens are immediately invalidated (JTI blacklist) — each token can only be used once
- Password reconfirmation required before permanent account deletion — protects against an attacker with a briefly obtained access token
- CSRF origin validation on all cookie-consuming endpoints (refresh, logout, account deletion)
- Brute force protection on all authentication endpoints
- Account enumeration prevention — login errors never reveal whether an email exists

### Cookie Consent
- VenderScope presents a cookie consent banner and a footer-level **Cookie Settings** control
- Users may accept or decline **optional** cookies without degrading core platform use
- Declining optional cookies clears optional client-side storage namespaces while keeping strictly necessary auth cookies active
- The platform currently does not use advertising, tracking, or third-party analytics cookies

### Authorisation
- All authenticated endpoints require a valid JWT access token
- All database queries are scoped to the authenticated user's ID
- Resources return 404 (not 403) for unauthorised access to prevent existence enumeration
- Vendor IDs are UUIDs — not sequential integers
- Guest mode endpoints (`/api/guest/scan`, `/api/guest/report`) are intentionally public — they perform no DB reads or writes and are separately rate-limited

### Guest Mode Security
Guest mode was introduced in v3.5 with security as the primary design constraint:

- **Zero data persistence** — `scan_ephemeral()` makes no database calls. No vendor, event, or score record is created.
- **SSRF validation** — the user-supplied domain is checked against the full SSRF blocklist (RFC1918, loopback, link-local, cloud metadata endpoints, URL-encoding bypass prevention) before any external call is made
- **CVE-only scope** — only the NIST NVD API is called. HIBP, Shodan, Companies House, compliance scraping, and vendor profiling are excluded
- **Strict input validation** — Pydantic validators enforce length limits on all fields, a severity allowlist (CRITICAL/HIGH/MEDIUM/LOW), score range 0–100, and a maximum of 50 events per report request
- **XML injection prevention** — every user-supplied string is passed through `_xml_escape()` before reaching ReportLab in PDF generation
- **Rate limiting** — 3 scans/hour and 5 reports/hour per real client IP (XFF[-1], Render-appended)
- **No auth cookie consumed** — guest endpoints do not read or use the `vs_refresh` cookie

### Data in Transit
- All traffic served over HTTPS (TLS 1.2+)
- HTTP Strict Transport Security (HSTS) enforced in production
- CORS restricted to known frontend origins only

### Data at Rest
- Database encrypted at rest (PostgreSQL on Neon)
- No sensitive data stored in application logs
- Secrets managed via environment variables — never committed to source code

### Server-Side Request Forgery (SSRF) Protection
All outbound HTTP requests to user-supplied or externally-sourced domains are validated against:
- RFC1918 private range blocklist (10.x, 172.16–31.x, 192.168.x)
- Loopback blocklist (127.x, ::1, and numeric/encoded variants)
- Link-local blocklist (169.254.x)
- Cloud metadata endpoint blocklist (GCP, Azure, Alibaba Cloud, and AWS IMDSv1)
- IPv6-mapped IPv4 address detection
- URL-encoding bypass prevention (e.g. `127%2E0%2E0%2E1`)
- Decimal and octal IP notation detection

Redirect chains are followed manually (max 3 hops) — each intermediate destination is independently validated before following.

DNS resolution is performed and the resolved IP is checked, not just the hostname — prevents DNS rebinding attacks.

### Content Security Policy
From v3.5, the Vercel-hosted frontend enforces a Content-Security-Policy response header:
- `default-src 'self'`
- `connect-src` locked to the known API origin
- `object-src 'none'`
- `frame-ancestors 'none'`

This provides browser-level XSS mitigation in addition to React's built-in output escaping.

### Dependency Security
- Dependencies reviewed before addition
- `npm audit` and `pip-audit` run before every release
- Dependabot enabled for automated vulnerability alerts

### Rate Limiting
- Authentication endpoints: 5 requests per minute per IP
- Registration: 3 requests per hour per IP
- Guest scan: 3 requests per hour per IP
- Guest report: 5 requests per hour per IP
- All limits enforced per real client IP — resolved from `X-Forwarded-For[-1]` (Render-appended, unforgeable)

### Audit Logging
- All authentication events (login, logout, failed attempts, account deletion) are logged with IP and timestamp
- All state-changing operations (vendor add/delete, scan triggers, exports) are recorded
- Logs contain no sensitive data (no passwords, no tokens, no personal data beyond user ID and IP)

---

## Security Audits & Disclosures

VenderScope undergoes a full white-box security audit before every significant release. All findings are disclosed below.

---

### v3.5 Audit — 26 March 2026 (Guest Mode)
**Scope:** All new code introduced by the Guest Mode feature: `routers/guest.py`, `services/scanner.py` (`scan_ephemeral`), `services/pdf_export.py` (`generate_guest_pdf`), `frontend/src/pages/GuestScanPage.jsx`, `frontend/vercel.json`.
**Test result:** 55/55 security tests passing (23 new tests added)

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| G-01 | HIGH | **Rate limit IP bypass** — `_real_ip()` in `limiter.py` used `XFF[0]`, which is client-controlled. An attacker could spoof a `X-Forwarded-For` header and cycle through fake IPs to bypass the 3/hour rate limit on unauthenticated guest endpoints, where rate limiting is the only protection. | Changed to `XFF[-1]` (Render appends the real client IP as the last entry; it is unforgeable). Now consistent with the audit log fix from v3.1. |
| G-02 | MEDIUM | **No Content-Security-Policy on frontend** — `SecurityHeadersMiddleware` set security headers on API (JSON) responses, not on the HTML pages served by Vercel. Without a CSP on the actual page, there was no browser-level XSS mitigation layer. | Added a `headers` block to `frontend/vercel.json` setting CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy on all Vercel-served pages. |
| G-03 | LOW | **Misleading import alias** — `fastapi.responses.Response` was aliased as `StreamingResponse` in `routers/guest.py`. `StreamingResponse` is a real, distinct FastAPI class; the alias could confuse future maintainers. | Removed alias; import corrected to `from fastapi.responses import Response`. |

**Confirmed clean (no issue found):**
- Zero DB writes in `scan_ephemeral` — verified by test `test_guest_scan_no_db_write`
- SSRF validation gates all scan requests — `localhost`, `127.0.0.1`, and all RFC1918 ranges return 400
- XML injection in PDF — `<script>alert(1)</script>&'"` in event title produces valid PDF without crash
- Input validation — oversized domains, names, descriptions, titles, invalid severities, out-of-range scores all return 422
- Content-Disposition filename — hardcoded string, no user input reaches the HTTP header
- NVD API call uses URL parameters (not string concatenation) — no injection risk
- React auto-escapes CVE content — no `dangerouslySetInnerHTML` in `GuestScanPage.jsx`
- Stack traces suppressed — generic exception handler returns `{"detail": "Internal server error"}`

---

### v3.1 Audit — March 2026 (Secondary Audit)
**Scope:** Full codebase review post-v3.0 authentication launch.
**Test result:** 32/32 security tests passing (11 findings resolved)

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| HIGH-01 | HIGH | Per-client rate limiting broken behind Render proxy — all users shared one IP bucket | Fixed via `--proxy-headers` in `render.yaml` + `_real_ip()` key function |
| MED-01 | MEDIUM | Account deletion had no password reconfirmation — brief access token compromise could silently delete account | Password reconfirmation required before deletion |
| MED-02 | MEDIUM | Audit log IP sourced from `XFF[0]` — spoofable by clients | Changed to `XFF[-1]` (Render-appended) |
| MED-03 | MEDIUM | No CSRF protection on `logout`, `refresh`, `delete_account` cookie endpoints | `_verify_origin()` added — compares scheme+netloc via `urlparse` (a previous `startswith` bypass was also closed) |
| SSRF | MEDIUM | `_is_safe_domain()` had multiple bypasses: URL-encoding, decimal IP, IPv6-mapped IPv4, cloud metadata endpoints, 3-hop redirect chain | Full hardening applied |
| HIBP | LOW | Substring domain match caused false positives; no cache on the 1MB breach list | Exact match + www-normalisation; 1hr in-process cache |
| PDF | LOW | ReportLab XML injection — user-supplied strings not escaped | `_xml_escape()` applied to all external data |
| Email | LOW | HTML injection in alert templates | `_html_escape()` applied to all external data |
| Quota | LOW | File race condition on quota.json | `threading.RLock()` wrapping entire check-and-load block |
| LOW-01 | LOW | Refresh token lifetime was 30 days | Reduced to 7 days |
| LOW-02 | LOW | Stale SQLite `DATABASE_URL` in `render.yaml` would override the Neon PostgreSQL secret if the dashboard value was cleared | Removed from `render.yaml` |

---

### v3.0 Audit — March 2026 (Initial Security Audit)
**Scope:** Full codebase audit at launch of v3 authentication.
**Test result:** 32/32 security tests passing (20 findings resolved)

Findings covered authentication token handling, IDOR protection, bcrypt DoS prevention (CRIT-03), user enumeration timing attacks (CRIT-01), stack trace exposure, security header gaps, JWT algorithm confusion (CVE-2015-9235), and SSRF in the compliance discovery engine.

Full technical detail in `tasks/security-architecture.md`.

---

## Known Limitations

- **Email alerts:** Currently use SMTP in development. Production deployments should configure Resend (HTTP API) via the `RESEND_API_KEY` environment variable once a verified sending domain is available.
- **Rate limiting on Render free tier:** Rate limits are enforced per real client IP via `XFF[-1]`. Render free tier does not offer a fixed load balancer IP, so `--forwarded-allow-ips="*"` is required — a motivated attacker with control of an upstream proxy could theoretically influence the XFF chain. This is a known Render free-tier architectural constraint.
- **Self-hosted deployments:** Security of self-hosted instances is the responsibility of the operator.

---

## Security Hall of Fame

We thank the following researchers for responsible disclosure:

_(None yet — be the first)_
