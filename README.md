# VenderScope

> **Still running annual vendor audits? Your next breach won't wait 12 months.**

[![Live Beta - v3](https://img.shields.io/badge/Live%20Demo-venderscope.vercel.app-6366f1?style=for-the-badge)](https://venderscope.vercel.app)
[![API](https://img.shields.io/badge/API-venderscope--api.onrender.com-10b981?style=for-the-badge)](https://venderscope-api.onrender.com/docs)
[![GitHub](https://img.shields.io/badge/GitHub-darkyzowo%2Fvenderscope-gray?style=for-the-badge&logo=github)](https://github.com/darkyzowo/venderscope)
[![Version](https://img.shields.io/badge/version-v3.0-violet?style=for-the-badge)](https://github.com/darkyzowo/venderscope/releases/tag/v3)

> **Performance note:** VenderScope runs on Render's free tier. The first request after inactivity includes a ~50s cold start. Actual scan time is 8–15s using concurrent API calls to HIBP, NVD, Companies House, Shodan, and the compliance engine simultaneously.

VenderScope is a continuous, passive vendor risk intelligence platform built for GRC and Information Security professionals. Instead of point-in-time annual reviews, VenderScope monitors your vendor estate 24/7 across multiple threat intelligence sources and surfaces risk drift in real time — with full user authentication, production-grade security hardening, and a cloud PostgreSQL backend.

---

## What's New in v3

### Authentication & Multi-User Support
- **JWT authentication** — access token stored in memory (15min expiry), refresh token in `httpOnly` `SameSite=Strict` cookie (30 days)
- **Register / Login / Logout** — full auth flow with bcrypt password hashing (12 rounds)
- **Per-user vendor isolation** — every database query is scoped to the authenticated user; no user can see or scan another user's vendors
- **Silent token refresh** — `AuthContext` silently renews the access token on mount and 401, keeping sessions seamless
- **Password complexity rules** — minimum 12 characters, requires at least one uppercase letter and one digit; enforced on both frontend and backend
- **Confirmation email on registration** — welcome email sent via Resend HTTP API (Gmail SMTP fallback for local dev)

### Security Hardening
- **JTI blacklist** — single-use refresh tokens; each rotation revokes the previous token's JWT ID; logout immediately invalidates the current refresh token
- **Append-only audit log** — every security event (`login.success`, `login.failed`, `logout`, `register.success`, `vendor.added`, `vendor.deleted`, `vendor.scanned`, `export.pdf`, `account.deleted`, `token.refreshed`) is recorded with IP address and timestamp
- **Security headers middleware** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS in production)
- **FRONTEND_URL startup validation** — server refuses to start if `FRONTEND_URL` is missing or misconfigured in production
- **UUID vendor IDs** — vendor primary keys are UUIDs (not sequential integers), preventing IDOR enumeration
- **bcrypt DoS protection** — max password length enforced at login to prevent billion-hash attacks
- **All 20 audit vulnerabilities resolved** (see `docs/security-architecture.md`)

### Infrastructure
- **PostgreSQL (Neon)** — migrated from SQLite to cloud PostgreSQL for production; SQLite retained for local dev
- **pg8000 pure-Python driver** — compatible with Python 3.14+, no C dependencies, works on Render without build tools
- **Connection pool** — `pool_pre_ping`, `pool_size=5`, `max_overflow=10` for stable cloud connections
- **Revoked token cleanup** — APScheduler purges expired JTI blacklist entries every 6 hours

### UI & Account Management
- **Delete Account** — 2-step confirmation flow (warning → type "DELETE"); cascades to all vendor data
- **Footer** — privacy policy, terms, and security documentation links; subtle delete account trigger
- **Legal & security docs** — `/privacy`, `/terms`, `/security` pages rendered from markdown

### Alerts (Code Complete — Pending Production Domain)
- **Resend HTTP API** — rebuilt alerts dispatcher; uses Resend if a verified sending domain is configured, falls back to Gmail SMTP automatically
- **Per-user alert emails** — scan alerts now go to the vendor owner's registered email, not a hardcoded address

---

## Features

- **Continuous Passive Monitoring** — Automatically scans vendors every 24 hours with zero manual effort
- **Multi-Source Intelligence** — Aggregates risk signals from HIBP, NVD (NIST), Companies House, and Shodan simultaneously
- **Live Risk Scoring** — Weighted severity scoring engine (0–100) with CRITICAL/HIGH/MEDIUM/LOW classification
- **Risk Score Drift Timeline** — Area chart showing how a vendor's risk posture changes over time
- **Vendor Profile Auto-Discovery** — Passively detects description, authentication method, and 2FA support from public pages
- **Third-Party Certification Attribution** — Distinguishes vendors who hold certs directly vs those referencing their infrastructure providers' certs
- **UK-Native Governance** — Companies House integration flags financial distress, overdue filings, and director changes
- **One-Click PDF Export** — Structured for ISO 27001 Annex A and Cyber Essentials reviews
- **Exposed Infrastructure Detection** — Shodan flags dangerous open ports (RDP, SMB, MongoDB, etc.)
- **24hr Intelligent Caching** — Repeat scans return instantly; nightly scheduler forces fresh data overnight
- **Two-Stage Compliance Discovery** — Scrapes vendor pages for ISO 27001, SOC 2, GDPR, Cyber Essentials, PCI DSS evidence; Google CSE fallback when direct scraping is insufficient
- **Verified Security Contacts** — Finds security/privacy contacts via RFC 9116 `security.txt`, page scraping, and web search
- **Scan Quota Tracker** — Live banner showing remaining Google CSE quota with automatic daily reset

---

## Tech Stack

| Layer         | Technology                                                                   |
|---------------|------------------------------------------------------------------------------|
| Backend       | Python 3.11+, FastAPI, SQLAlchemy 2.0, APScheduler, Uvicorn                 |
| Database      | PostgreSQL (Neon, production) / SQLite (local dev)                           |
| DB Driver     | pg8000 (pure Python, Python 3.14+ compatible)                                |
| Authentication| JWT (python-jose), bcrypt, httpOnly cookies                                  |
| Frontend      | React 19, Vite 8, React Router 7, TailwindCSS 3, Recharts, Axios            |
| Intelligence  | HIBP API, NVD/NIST API, Companies House API, Shodan API                      |
| Compliance    | Google Custom Search API, BeautifulSoup4, security.txt                       |
| Email         | Resend HTTP API (production) / Gmail SMTP (local dev)                        |
| PDF Export    | ReportLab                                                                    |
| Rate Limiting | SlowAPI                                                                      |

---

## Intelligence Sources

| Source              | What it detects                                                              |
|---------------------|------------------------------------------------------------------------------|
| **HaveIBeenPwned**  | Domain breach exposure across all known data breaches                        |
| **NVD (NIST)**      | CVEs associated with vendor products and services                            |
| **Companies House** | UK company status, overdue filings, director resignations                    |
| **Shodan**          | Exposed ports and services on vendor infrastructure                          |
| **Google CSE**      | External certification evidence for ISO 27001, SOC 2, DPA, and more         |
| **Vendor Profile**  | Homepage meta description, auth method, and 2FA support (passive scrape)    |

---

## Architecture

```
VenderScope/
├── backend/
│   ├── main.py                   # FastAPI app, CORS, security headers, lifespan
│   ├── models.py                 # Vendor, RiskEvent, RiskScoreHistory, User,
│   │                             #   RevokedToken, AuditLog (SQLAlchemy)
│   ├── database.py               # PostgreSQL + SQLite connection (pg8000, ssl_context)
│   ├── scheduler.py              # 24hr scan + 6hr JTI cleanup + 10min keep-alive
│   ├── routers/
│   │   ├── auth.py               # Register, login, refresh, logout, /me, delete account
│   │   ├── vendors.py            # Vendor CRUD (all user-scoped)
│   │   ├── intelligence.py       # Scan trigger endpoints
│   │   ├── export.py             # PDF export (Content-Disposition sanitised)
│   │   └── quota.py              # Google CSE quota status
│   └── services/
│       ├── scanner.py            # Concurrent scan orchestrator + caching
│       ├── auth_service.py       # JWT encode/decode, password hash, get_current_user
│       ├── audit.py              # Append-only security event recorder
│       ├── alerts.py             # Resend HTTP API + Gmail SMTP dispatcher
│       ├── compliance_discovery.py  # Two-stage compliance + cert discovery
│       ├── vendor_profile.py     # Passive vendor description, auth & 2FA discovery
│       ├── quota.py              # Google CSE daily quota tracker
│       ├── hibp.py               # HIBP breach intelligence
│       ├── nvd.py                # NVD CVE intelligence
│       ├── companies_house.py    # UK governance checks
│       ├── shodan_service.py     # Exposed infrastructure checks
│       └── pdf_export.py         # ReportLab PDF generator
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.jsx             # Auth: login form + deleted account banner
        │   ├── Register.jsx          # Auth: register with client-side complexity rules
        │   ├── Dashboard.jsx         # Main vendor overview
        │   ├── VendorDetail.jsx      # Per-vendor risk detail + profile panel
        │   └── DocPage.jsx           # Lightweight markdown renderer for /privacy, /terms, /security
        ├── components/
        │   ├── VendorCard.jsx        # Risk score card
        │   ├── ScoreChart.jsx        # Drift timeline area chart
        │   ├── EventFeed.jsx         # Risk events list
        │   ├── AddVendorModal.jsx    # Add vendor form
        │   ├── CompliancePanel.jsx   # Compliance posture with badge system
        │   ├── QuotaBanner.jsx       # Daily scan quota tracker
        │   ├── Footer.jsx            # Links to docs + delete account trigger
        │   └── DeleteAccountModal.jsx # 2-step account deletion (type "DELETE" to confirm)
        ├── contexts/AuthContext.jsx  # JWT access token in memory, silent refresh
        ├── docs/
        │   ├── privacy.md
        │   ├── terms.md
        │   └── security.md
        └── api/client.js            # Axios client, auth headers, token refresh
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- API keys for: NVD, Companies House, Shodan, Google Custom Search

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# Intelligence APIs
NVD_API_KEY=your_key
COMPANIES_HOUSE_API_KEY=your_key
SHODAN_API_KEY=your_key
GOOGLE_CSE_API_KEY=your_key
GOOGLE_CSE_ID=your_cse_id

# Email (local: Gmail SMTP; production: Resend with verified domain)
GMAIL_ADDRESS=your@gmail.com
GMAIL_APP_PASSWORD=your_app_password
# RESEND_API_KEY=re_...           # Uncomment when you have a verified sending domain
# RESEND_FROM_EMAIL=VenderScope <alerts@yourdomain.com>
ALERT_THRESHOLD=70

# Auth
JWT_SECRET=your_64_char_hex_secret

# Frontend (must match your deployed frontend URL in production)
FRONTEND_URL=http://localhost:5173

# Database (PostgreSQL for production, SQLite for local)
DATABASE_URL=sqlite:///./vendorscope.db
# DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

```bash
uvicorn main:app --reload
# API: http://127.0.0.1:8000
# Docs: http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

Create `frontend/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

---

## Authentication

VenderScope uses a **dual-token JWT scheme**:

| Token | Storage | Expiry | Purpose |
|-------|---------|--------|---------|
| Access token | JS memory (never localStorage) | 15 minutes | Bearer auth on every API request |
| Refresh token | `httpOnly` `SameSite=Strict` cookie | 30 days | Silently issues new access tokens |

**Token rotation:** Every refresh issues a new refresh token and immediately revokes the previous token's JWT ID (JTI) in the database. Replayed refresh tokens are rejected.

**Logout:** Instantly blacklists the current refresh token's JTI. The token is useless even if intercepted.

**Session persistence:** On page load, `AuthContext` calls `/api/auth/refresh` to silently restore the session from the cookie — no re-login needed after browser restart.

---

## Security Architecture

VenderScope has undergone a full security audit. Key controls:

| Control | Implementation |
|---------|---------------|
| Authentication | JWT with httpOnly cookie refresh tokens |
| Authorization | Every DB query scoped to `current_user.id` |
| IDOR protection | All resource endpoints return 404 (not 403) for unauthorised access |
| Brute force protection | Rate limiting on all auth endpoints (SlowAPI) |
| Password storage | bcrypt 12 rounds |
| Password policy | Min 12 chars, uppercase, digit |
| DoS protection | Max password length at login (prevents billion-hash attack) |
| XSS | Access token in memory only; httpOnly cookie for refresh |
| SSRF | DNS resolution check on all outbound URL fetches |
| SQL injection | SQLAlchemy ORM (parameterised queries throughout) |
| Header injection | PDF Content-Disposition filename sanitised with regex |
| Security headers | X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy |
| Audit trail | Append-only AuditLog table; X-Forwarded-For aware |
| Secrets | All credentials in environment variables; `.env` gitignored |
| Token replay | JTI blacklist on logout + single-use refresh tokens |
| Session tokens | UUIDs (not sequential integers) for vendor IDs |
| Input validation | Pydantic validators on all inputs; domain normalised on ingest |
| Startup checks | FRONTEND_URL validated at startup; server refuses to start if misconfigured |

Full audit findings and remediation notes: `docs/security-architecture.md`

---

## Risk Scoring

Scores use a weighted average of the top 5 detected events with a count multiplier — preventing low-severity CVE lists from inflating scores artificially.

| Severity | Score Value |
|----------|-------------|
| CRITICAL | 100 |
| HIGH     | 70 |
| MEDIUM   | 40 |
| LOW      | 15 |

Top 5 events by severity are averaged, multiplied by a count factor (up to 1.4× for vendors with many signals), capped at 100. Vendors scoring ≥ `ALERT_THRESHOLD` (default 70) trigger email alerts to the vendor owner's registered email address.

---

## Compliance Discovery

**Stage 1 — Page scrape (free):** Fetches the vendor homepage, security page, privacy policy, and trust centre. Searches for evidence of ISO 27001, SOC 2, GDPR, Cyber Essentials, PCI DSS, and Data Processing Agreements.

**Stage 2 — Web search fallback (costs Google CSE quota):** For any certification not found on the vendor's own pages, fires targeted Google Custom Search queries to find external evidence.

### Third-Party Attribution Detection

VenderScope detects a common false positive — vendors referencing their *infrastructure providers'* certifications rather than their own. Matches are analysed at sentence/element granularity. If every occurrence of a cert keyword appears in a third-party attribution context, the result is flagged **"Via infra partners"** instead of **"Verified"**.

| Badge | Meaning |
|-------|---------|
| **Verified** | Evidence found on vendor's own website claiming direct ownership |
| **External source** | Evidence found via web search |
| **Via infra partners** | Cert belongs to infrastructure providers, not the vendor |
| **No evidence** | Nothing found |

### Scan Quota

Google Custom Search allows 100 free queries/day. Each Full Intelligence Scan uses up to 14 units (~7 full scans/day at no cost). When quota is exhausted, scans automatically fall back to Standard Scan (page scrape only). Quota resets at midnight UTC.

---

## Vendor Profile Discovery

During every scan, VenderScope passively discovers three data points at no quota cost:

**Description** — Scraped from `og:description` or `<meta name="description">`.

**Authentication Method** — Detected from public pages across 11 categories (SSO/SAML, OpenID Connect, OAuth 2.0, Passwordless, Social Login, Okta/Auth0, Password-based).

**2FA Support** — "Yes" if MFA/2FA/TOTP/authenticator keywords are found. Returns "Not detected" rather than "No" — absence of evidence is not evidence of absence.

---

## Known Limitations

**Cold starts on Render free tier:** First request after inactivity incurs ~50s cold start. Keep-alive pings run every 10 minutes to minimise this.

**JS-rendered trust centres:** Vendors using Vanta or similar platforms load certifications dynamically. VenderScope's scraper fetches raw HTML and relies on the Google CSE fallback for these.

**Email alerts in production:** Render's free tier blocks outbound SMTP. Resend HTTP API is wired up and ready — it activates automatically once a verified sending domain is configured in `RESEND_FROM_EMAIL`. Until then, alerts are skipped in production and delivered locally via Gmail SMTP.

**Scheduler scope:** The 24hr background scheduler scans all vendors. Per-user scheduler scoping (so users only get alerts for their own vendors) is on the roadmap.

---

## Roadmap

- [x] Multi-source passive intelligence engine
- [x] Risk score drift timeline
- [x] Companies House UK integration
- [x] PDF audit export (ISO 27001 ready)
- [x] Shodan exposed infrastructure detection
- [x] 24hr intelligent caching + nightly scheduler
- [x] Concurrent API fetching
- [x] Compliance posture auto-discovery
- [x] Two-stage certification detection (scrape + Google CSE)
- [x] Third-party certification attribution detection
- [x] Verified security contact discovery
- [x] Daily scan quota tracker
- [x] Vendor profile auto-discovery
- [x] Full JWT authentication (v3)
- [x] Per-user vendor isolation (v3)
- [x] bcrypt password hashing + complexity rules (v3)
- [x] JTI blacklist / single-use refresh tokens (v3)
- [x] Append-only audit log (v3)
- [x] Security headers middleware (v3)
- [x] UUID vendor IDs (v3)
- [x] PostgreSQL (Neon) + pg8000 migration (v3)
- [x] Resend HTTP API email dispatcher (v3, pending sending domain)
- [x] Account deletion with cascade (v3)
- [x] Legal and security documentation pages (v3)
- [ ] Email alerts in production (requires verified Resend domain)
- [ ] Per-user alert configuration (threshold, channel, webhook)
- [ ] Async task queue (Celery + Redis)
- [ ] Multi-user scheduler scoping
- [ ] News Feed — vendor reputation monitoring via RSS + HackerNews
- [ ] EPSS exploit probability scoring integration

---

## Deployment

### Backend (Render)

Required environment variables on Render:

```
DATABASE_URL        postgresql://...neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET          64-char hex string
FRONTEND_URL        https://venderscope.vercel.app
NVD_API_KEY
COMPANIES_HOUSE_API_KEY
SHODAN_API_KEY
GOOGLE_CSE_API_KEY
GOOGLE_CSE_ID
GMAIL_ADDRESS       (optional — local email fallback)
GMAIL_APP_PASSWORD  (optional)
ALERT_THRESHOLD     70
RENDER               true   (enables HSTS + SameSite=None cookies)
```

### Frontend (Vercel)

```
VITE_API_URL        https://venderscope-api.onrender.com/api
```

---

## Motivation

Built from direct experience managing 50+ vendor audits annually at Thrive Learning. Traditional GRC tooling (Vanta, SecurityScorecard, BitSight) costs thousands per year and is reactive. VenderScope is open-source, UK-aware via Companies House, and continuously passive — it watches your vendors so you don't have to.

---

## Author

**Syed Zarak Hassan**
Compliance Analyst & MSc Cyber Security Student
[LinkedIn](https://linkedin.com/in/zarak-hassan7) · [GitHub](https://github.com/darkyzowo)

---

_VenderScope is an independent open-source project. Data is sourced from public APIs and should be reviewed by a qualified security professional._
