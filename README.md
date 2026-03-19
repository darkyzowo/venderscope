# VenderScope

> **Still running annual vendor audits? Your next breach won't wait 12 months.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-venderscope.vercel.app-6366f1?style=for-the-badge)](https://venderscope.vercel.app)
[![API](https://img.shields.io/badge/API-venderscope--api.onrender.com-10b981?style=for-the-badge)](https://venderscope-api.onrender.com/docs)
[![GitHub](https://img.shields.io/badge/GitHub-darkyzowo%2Fvenderscope-gray?style=for-the-badge&logo=github)](https://github.com/darkyzowo/venderscope)

> **Performance note:** VenderScope is deployed on Render's free tier. The first scan after a period of inactivity includes a ~50 second cold start while the server wakes up. The actual scan logic runs in 8–15 seconds using concurrent API calls to HIBP, NVD, Companies House, Shodan, and the new Vendor Profile service simultaneously. In a production environment with a persistent server, scans would be near-instant. The architectural fix — PostgreSQL + async task queue (Celery/Redis) — is documented in the roadmap below.

VenderScope is a continuous, passive vendor risk intelligence platform built for GRC and Information Security professionals. Instead of point-in-time annual reviews, VenderScope monitors your vendor estate 24/7 across multiple threat intelligence sources and surfaces risk drift in real time.

---

## Features

- **Continuous Passive Monitoring** — Automatically scans vendors every 24 hours with zero manual effort
- **Multi-Source Intelligence** — Aggregates risk signals from HIBP, NVD (NIST), Companies House, and Shodan
- **Live Risk Scoring** — Weighted severity scoring engine (0–100) with CRITICAL/HIGH/MEDIUM/LOW classification
- **Risk Score Drift Timeline** — Area chart showing how a vendor's risk posture changes over time, with gradient fill, a custom tooltip, and graceful single-scan state
- **Vendor Profile Auto-Discovery** — Passively detects a vendor's one-line description (from homepage meta tags), authentication method (SSO/SAML/OAuth/Passwordless/etc.), and 2FA support — no manual entry needed
- **Third-Party Certification Attribution** — Compliance detection distinguishes between a vendor directly holding a cert (e.g. ISO 27001) vs their infrastructure providers holding it. False positives are flagged as "Via infra partners" rather than "Verified"
- **UK-Native** — Companies House integration flags financial distress, overdue filings, and director changes
- **Audit Export** — One-click PDF reports per vendor, structured for ISO 27001 Annex A and Cyber Essentials reviews
- **Exposed Infrastructure Detection** — Shodan integration flags dangerous open ports (RDP, SMB, MongoDB, etc.)
- **24hr Intelligent Caching** — Repeat scans within 24 hours return instantly; nightly scheduler forces fresh data overnight
- **Compliance Posture Discovery** — Auto-discovers privacy policies, terms, trust centres, and security contacts from vendor websites
- **Two-Stage Certification Detection** — Scrapes vendor pages for ISO 27001, SOC 2, GDPR, Cyber Essentials, PCI DSS, and DPA evidence; falls back to Google Custom Search for vendors without trust centres
- **Verified Security Contacts** — Finds real security/privacy contact emails via RFC 9116 `security.txt`, page scraping, and web search — never fabricates
- **Scan Quota Tracker** — Live banner showing remaining Full Intelligence Scans (Google CSE quota), with automatic daily reset at midnight UTC

---

## Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Backend       | Python 3.11+, FastAPI, SQLAlchemy, APScheduler          |
| Database      | SQLite (auto-migrating — safe column additions on startup) |
| Frontend      | React 19, Vite, TailwindCSS, Recharts                   |
| Intelligence  | HIBP API, NVD/NIST API, Companies House API, Shodan API |
| Compliance    | Google Custom Search API, BeautifulSoup, security.txt   |
| PDF Export    | ReportLab                                               |
| Rate Limiting | SlowAPI                                                 |

---

## Intelligence Sources

| Source              | What it detects                                                        |
| ------------------- | ---------------------------------------------------------------------- |
| **HaveIBeenPwned**  | Domain breach exposure across all known data breaches                  |
| **NVD (NIST)**      | CVEs associated with vendor products and services                      |
| **Companies House** | UK company status, overdue filings, director resignations              |
| **Shodan**          | Exposed ports and services on vendor infrastructure                    |
| **Google CSE**      | External certification evidence for ISO 27001, SOC 2, DPA, and more   |
| **Vendor Profile**  | Homepage meta description, auth method, and 2FA support (passive scrape) |

---

## Architecture

```
VenderScope/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting, startup migration
│   ├── models.py                # SQLAlchemy DB models (Vendor, RiskEvent, RiskScoreHistory)
│   ├── database.py              # DB connection, session, absolute path resolution
│   ├── scheduler.py             # 24hr background scan + keep-alive
│   ├── routers/
│   │   ├── vendors.py           # Vendor CRUD endpoints
│   │   ├── intelligence.py      # Scan trigger endpoints
│   │   ├── export.py            # PDF export endpoint
│   │   └── quota.py             # Scan quota status endpoint
│   └── services/
│       ├── scanner.py           # Concurrent scan orchestrator + caching
│       ├── compliance_discovery.py  # Two-stage compliance + cert discovery
│       │                            # with third-party attribution detection
│       ├── vendor_profile.py    # Passive vendor description, auth & 2FA discovery
│       ├── quota.py             # Google CSE quota tracker (auto-resets daily)
│       ├── hibp.py              # HIBP breach intelligence
│       ├── nvd.py               # NVD CVE intelligence
│       ├── companies_house.py   # UK governance checks
│       ├── shodan_service.py    # Exposed infrastructure checks
│       ├── alerts.py            # Email alert engine (local only)
│       └── pdf_export.py        # ReportLab PDF generator
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx        # Main vendor overview
        │   └── VendorDetail.jsx     # Per-vendor risk detail + profile panel
        ├── components/
        │   ├── VendorCard.jsx       # Risk score card
        │   ├── ScoreChart.jsx       # Drift timeline area chart
        │   ├── EventFeed.jsx        # Risk events list
        │   ├── AddVendorModal.jsx   # Add vendor form
        │   ├── CompliancePanel.jsx  # Compliance posture with badge system
        │   └── QuotaBanner.jsx      # Daily scan quota tracker
        └── api/client.js            # Axios API client
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

Create a `.env` file in `/backend`:

```env
NVD_API_KEY=your_key
COMPANIES_HOUSE_API_KEY=your_key
SHODAN_API_KEY=your_key
GMAIL_ADDRESS=your@gmail.com
GMAIL_APP_PASSWORD=your_app_password
ALERT_THRESHOLD=70
DATABASE_URL=sqlite:///./vendorscope.db
GOOGLE_CSE_API_KEY=your_key
GOOGLE_CSE_ID=your_cse_id
```

```bash
uvicorn main:app --reload
```

API runs at `http://127.0.0.1:8000` — interactive docs at `/docs`

> **Database migrations** are handled automatically on startup. Adding new columns to an existing `vendorscope.db` requires no manual steps — the app detects and applies missing columns safely via `PRAGMA table_info` on every boot.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Vendor Profile Discovery

During every scan, VenderScope passively discovers three additional data points about each vendor without any quota cost:

**Description** — Scraped from the vendor's homepage `og:description` or `<meta name="description">` tag. Gives a concise one-line summary of what the vendor does, useful for audit documentation.

**Authentication Method** — Detected by scraping the homepage, login page, and security page for patterns across 11 auth categories (ordered by specificity):

| Detected Label   | Trigger Signals                                              |
|-----------------|--------------------------------------------------------------|
| SSO (SAML 2.0)  | `saml 2.0`, `saml-based sso`                                 |
| SAML            | `saml`                                                       |
| OpenID Connect  | `openid connect`, `oidc`                                     |
| SSO             | `single sign-on`, `single sign on`                           |
| OAuth 2.0       | `oauth 2.0`, `oauth2.0`                                      |
| OAuth           | `oauth`                                                      |
| Passwordless    | `passwordless`, `magic link`, `passkey`, `webauthn`          |
| Social Login    | `sign in with google`, `sign in with github`, etc.           |
| Okta / Auth0    | `okta`, `auth0`                                              |
| Password-based  | `email and password`, `sign in with email`                   |

**2FA Support** — Detected from the same pages. Returns "Yes" if MFA/2FA/TOTP/authenticator app keywords are found. Returns "Not detected" rather than "No" — absence of public mention is not proof of absence.

---

## Compliance Discovery

VenderScope automatically discovers a vendor's compliance posture during each scan using a two-stage pipeline:

**Stage 1 — Page scrape:** Fetches the vendor homepage, security page, privacy policy, and trust centre (if detected). Searches for keyword evidence of ISO 27001, SOC 2, GDPR, Cyber Essentials, PCI DSS, and Data Processing Agreements.

**Stage 2 — Web search fallback (Full Intelligence Scan):** For any certification not found on the vendor's own pages, fires targeted Google Custom Search queries to find external evidence — press releases, certification body registers, blog posts, and PDFs.

### Third-Party Attribution Detection

A common false positive in compliance scraping is vendors referencing their *infrastructure providers'* certifications rather than their own. For example:

> *"All of the third parties providing our core infrastructure are ISO27001 and SOC2 certified."*

VenderScope's attribution engine analyses each keyword match at sentence/element granularity (splitting on HTML tags and punctuation boundaries). If every occurrence of a cert keyword is found in a third-party attribution context, the result is flagged as **"Via infra partners"** rather than **"Verified"**. Direct evidence always wins — if a vendor page simultaneously claims direct ownership AND mentions certified infrastructure, the result resolves to "Verified".

Results are labelled as:

| Badge              | Meaning                                                             |
|--------------------|---------------------------------------------------------------------|
| **Verified**       | Evidence found on vendor's own website claiming direct ownership    |
| **External source** | Evidence found via web search — links to source                    |
| **Via infra partners** | Cert belongs to vendor's infrastructure providers, not the vendor |
| **No evidence**    | Nothing found anywhere                                              |

### Scan Quota

Google Custom Search has a free tier of 100 queries/day. VenderScope tracks this automatically:

- Each **Full Intelligence Scan** costs up to 14 quota units
- At 100 units/day, this allows ~7 full scans per day at no cost
- When quota is exhausted, scans automatically fall back to **Standard Scan** (page scrape only — no Google API calls)
- Quota resets automatically at midnight UTC
- The quota banner shows remaining scans in real time on both the dashboard and vendor detail pages

---

## Risk Scoring

Risk scores use a weighted average of the top detected events, with a count multiplier for vendors with many signals. This prevents low-severity CVE lists from inflating scores artificially.

| Severity | Score Value |
| -------- | ----------- |
| CRITICAL | 100         |
| HIGH     | 70          |
| MEDIUM   | 40          |
| LOW      | 15          |

The top 5 events by severity are averaged, then multiplied by a count factor (up to 1.4× for vendors with many signals), capped at 100. Vendors scoring ≥70 trigger email alerts when running locally.

---

## Security Notes

- **CORS** is locked to the production Vercel domain — no wildcard origins in production
- **Rate limiting** is applied via SlowAPI to prevent API abuse
- **All API keys** are stored as environment variables — never committed to the repo
- **SSRF protection** — compliance discovery blocks all private/internal IP ranges before making any outbound requests
- **No authentication layer** — this is a single-user portfolio tool. Multi-user auth (JWT/OAuth) is on the roadmap
- **SQLite** is used for simplicity — not suitable for multi-user production; PostgreSQL migration is on the roadmap
- **Input validation** — vendor names capped at 100 characters, domains automatically stripped and normalised via Pydantic validators. SQLAlchemy ORM prevents SQL injection. React handles XSS protection automatically.

---

## Known Limitations

**Scan speed on free tier:**
VenderScope is deployed on Render's free tier (0.1 CPU / 512MB RAM). The first scan after inactivity includes a cold start delay of ~50 seconds. Actual scan time is 8–15 seconds. Use individual Scan Now buttons rather than Scan All for best results on the free tier.

**Compliance discovery on JS-rendered trust centres:**
Vendors using Vanta or similar JS-rendered trust centre platforms load their content dynamically after page render. VenderScope's scraper fetches raw HTML and cannot execute JavaScript, so certifications hosted exclusively inside these portals rely on the Google CSE web search fallback to be detected.

**Vendor profile detection accuracy:**
Auth method and 2FA detection are based on keyword matching against publicly available page content. Vendors with custom auth terminology or login flows behind SSO redirects may return "Not detected". This is intentional — the tool never guesses.

**Email alerts (local only):**
Email alerts work correctly when running VenderScope locally. Cloud hosting providers including Render's free tier block outbound SMTP connections at the network level. A future version will integrate an HTTP-based email API (e.g. SendGrid) to enable alerts in production.

**Shared demo database:**
The live demo at `venderscope.vercel.app` uses a single shared database. All visitors see the same vendor list. This is intentional for demo purposes — in real use, VenderScope should be self-hosted or deployed with user authentication.

---

## Motivation

Built from direct experience managing 50+ vendor audits annually at Thrive Learning. Traditional GRC tooling (Vanta, SecurityScorecard, BitSight) costs thousands per year and is reactive — it tells you where you stand today, not where you're heading. VenderScope is open-source, UK-aware via Companies House, and continuously passive — it watches your vendors so you don't have to.

---

## Roadmap

- [x] Multi-source passive intelligence engine
- [x] Risk score drift timeline (area chart with gradient fill)
- [x] Companies House UK integration
- [x] PDF audit export (ISO 27001 ready)
- [x] Shodan exposed infrastructure detection
- [x] 24hr intelligent caching
- [x] Concurrent API fetching for scan speed
- [x] Deployment (Render + Vercel)
- [x] Compliance posture auto-discovery (documents, trust centre, certifications)
- [x] Two-stage certification detection (page scrape + Google CSE web search fallback)
- [x] Third-party certification attribution detection
- [x] Verified security contact discovery (security.txt, page scrape, web search)
- [x] Daily scan quota tracker with automatic reset
- [x] Vendor profile auto-discovery (description, auth method, 2FA support)
- [x] Database auto-migration (safe column additions on startup)
- [ ] Email alerts in production (HTTP-based, e.g. SendGrid)
- [ ] User authentication (JWT / OAuth)
- [ ] Async task queue (Celery + Redis) for reliable Scan All
- [ ] PostgreSQL migration for production deployments
- [ ] Multi-user support with vendor estate isolation
- [ ] NewsAPI vendor reputation monitoring

---

## Author

**Syed Zarak Hassan**
Compliance Analyst & MSc Cyber Security Student
[LinkedIn](https://linkedin.com/in/zarak-hassan7) · [GitHub](https://github.com/darkyzowo)

---

_VenderScope is an independent open-source project. Data is sourced from public APIs and should be reviewed by a qualified security professional._
