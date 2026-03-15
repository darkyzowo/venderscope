# VenderScope 🔍

> **Still running annual vendor audits? Your next breach won't wait 12 months.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-venderscope.vercel.app-6366f1?style=for-the-badge)](https://venderscope.vercel.app)
[![API](https://img.shields.io/badge/API-venderscope--api.onrender.com-10b981?style=for-the-badge)](https://venderscope-api.onrender.com/docs)
[![GitHub](https://img.shields.io/badge/GitHub-darkyzowo%2Fvenderscope-gray?style=for-the-badge&logo=github)](https://github.com/darkyzowo/venderscope)

> **⚡ Performance note:** VenderScope is deployed on Render's free tier. The first scan after a period of inactivity includes a ~50 second cold start while the server wakes up. The actual scan logic runs in 8–15 seconds using concurrent API calls to HIBP, NVD, Companies House, and Shodan simultaneously. In a production environment with a persistent server, scans would be near-instant. The architectural fix — PostgreSQL + async task queue (Celery/Redis) — is documented in the roadmap below.

VenderScope is a continuous, passive vendor risk intelligence platform built for GRC and Information Security professionals. Instead of point-in-time annual reviews, VenderScope monitors your vendor estate 24/7 across multiple threat intelligence sources and surfaces risk drift in real time.

---

## 🚀 Features

- **Continuous Passive Monitoring** — Automatically scans vendors every 24 hours with zero manual effort
- **Multi-Source Intelligence** — Aggregates risk signals from HIBP, NVD (NIST), Companies House, and Shodan
- **Live Risk Scoring** — Weighted severity scoring engine (0–100) with CRITICAL/HIGH/MEDIUM/LOW classification
- **Risk Score Drift Timeline** — Visual chart showing how a vendor's risk posture changes over time
- **UK-Native** — Companies House integration flags financial distress, overdue filings, and director changes
- **Audit Export** — One-click PDF reports per vendor, structured for ISO 27001 Annex A and Cyber Essentials reviews
- **Exposed Infrastructure Detection** — Shodan integration flags dangerous open ports (RDP, SMB, MongoDB, etc.)
- **24hr Intelligent Caching** — Repeat scans within 24 hours return instantly; nightly scheduler forces fresh data overnight

---

## 🛠️ Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Backend       | Python, FastAPI, SQLAlchemy, APScheduler                |
| Database      | SQLite                                                  |
| Frontend      | React, Vite, TailwindCSS, Recharts                      |
| Intelligence  | HIBP API, NVD/NIST API, Companies House API, Shodan API |
| PDF Export    | ReportLab                                               |
| Rate Limiting | SlowAPI                                                 |

---

## 📡 Intelligence Sources

| Source              | What it detects                                           |
| ------------------- | --------------------------------------------------------- |
| **HaveIBeenPwned**  | Domain breach exposure across all known data breaches     |
| **NVD (NIST)**      | CVEs associated with vendor products and services         |
| **Companies House** | UK company status, overdue filings, director resignations |
| **Shodan**          | Exposed ports and services on vendor infrastructure       |

---

## 🏗️ Architecture

```
VenderScope/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting
│   ├── models.py                # SQLAlchemy DB models
│   ├── database.py              # DB connection and session
│   ├── scheduler.py             # 24hr background scan + keep-alive
│   ├── routers/
│   │   ├── vendors.py           # Vendor CRUD endpoints
│   │   ├── intelligence.py      # Scan trigger endpoints
│   │   └── export.py            # PDF export endpoint
│   └── services/
│       ├── scanner.py           # Concurrent scan orchestrator + caching
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
        │   └── VendorDetail.jsx     # Per-vendor risk detail
        ├── components/
        │   ├── VendorCard.jsx       # Risk score card
        │   ├── ScoreChart.jsx       # Drift timeline chart
        │   ├── EventFeed.jsx        # Risk events list
        │   └── AddVendorModal.jsx   # Add vendor form
        └── api/client.js            # Axios API client
```

---

## ⚙️ Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- API keys for: NVD, Companies House, Shodan

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
```

```bash
uvicorn main:app --reload
```

API runs at `http://127.0.0.1:8000` — interactive docs at `/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## 📊 Risk Scoring

Risk scores use a weighted average of the top detected events, with a count multiplier for vendors with many signals. This prevents low-severity CVE lists from inflating scores artificially.

| Severity | Score Value |
| -------- | ----------- |
| CRITICAL | 100         |
| HIGH     | 70          |
| MEDIUM   | 40          |
| LOW      | 15          |

The top 5 events by severity are averaged, then multiplied by a count factor (up to 1.4x for vendors with many signals), capped at 100. Vendors scoring ≥70 trigger email alerts when running locally.

---

## 🔒 Security Notes

- **CORS** is locked to the production Vercel domain — no wildcard origins in production
- **Rate limiting** is applied via SlowAPI to prevent API abuse
- **All API keys** are stored as environment variables — never committed to the repo
- **No authentication layer** — this is a single-user portfolio tool. Multi-user auth (JWT/OAuth) is on the roadmap
- **SQLite** is used for simplicity — not suitable for multi-user production; PostgreSQL migration is on the roadmap

---

## ⚠️ Known Limitations

**Scan speed on free tier:**
VenderScope is deployed on Render's free tier (0.1 CPU / 512MB RAM). The first scan after inactivity includes a cold start delay of ~50 seconds. Actual scan time is 8–15 seconds. Use individual ⚡ Scan Now buttons rather than Scan All for best results on the free tier.

**Email alerts (local only):**
Email alerts work correctly when running VenderScope locally. Cloud hosting providers including Render's free tier block outbound SMTP connections at the network level. A future version will integrate an HTTP-based email API (e.g. SendGrid) to enable alerts in production. This is logged in the roadmap below.

**No user authentication:**
The current deployment is a single-user demo. Anyone with the API URL can add or delete vendors. Authentication is on the roadmap.

---

## 💡 Motivation

Built from direct experience managing 50+ vendor audits annually at Thrive Learning. Traditional GRC tooling (Vanta, SecurityScorecard, BitSight) costs thousands per year and is reactive — it tells you where you stand today, not where you're heading. VenderScope is open-source, UK-aware via Companies House, and continuously passive — it watches your vendors so you don't have to.

---

## 📄 Roadmap

- [x] Multi-source passive intelligence engine
- [x] Risk score drift timeline
- [x] Companies House UK integration
- [x] PDF audit export (ISO 27001 ready)
- [x] Shodan exposed infrastructure detection
- [x] 24hr intelligent caching
- [x] Concurrent API fetching for scan speed
- [x] Deployment (Render + Vercel)
- [ ] Email alerts in production (HTTP-based, e.g. SendGrid)
- [ ] User authentication (JWT / OAuth)
- [ ] Async task queue (Celery + Redis) for reliable Scan All
- [ ] PostgreSQL migration for production deployments
- [ ] Multi-user support with vendor estate isolation
- [ ] NewsAPI vendor reputation monitoring

---

## 👤 Author

**Syed Zarak Hassan**
Compliance Analyst & MSc Cyber Security Student
[LinkedIn](https://linkedin.com/in/zarak-hassan7) · [GitHub](https://github.com/darkyzowo)

---

_VenderScope is an independent open-source project. Data is sourced from public APIs and should be reviewed by a qualified security professional._
