# VenderScope 🔍

> **Still running annual vendor audits? Your next breach won't wait 12 months.**

VenderScope is a continuous, passive vendor risk intelligence platform built for GRC and Information Security professionals. Instead of point-in-time annual reviews, VenderScope monitors your vendor estate 24/7 across multiple threat intelligence sources and surfaces risk drift in real time.

---

## 🚀 Features

- **Continuous Passive Monitoring** — Automatically scans vendors every 24 hours with zero manual effort
- **Multi-Source Intelligence** — Aggregates risk signals from HIBP, NVD (NIST), Companies House, and Shodan
- **Live Risk Scoring** — Weighted severity scoring engine (0–100) with CRITICAL/HIGH/MEDIUM/LOW classification
- **Risk Score Drift Timeline** — Visual chart showing how a vendor's risk posture changes over time
- **UK-Native** — Companies House integration flags financial distress, overdue filings, and director changes
- **Alert Engine** — Email notifications when a vendor's score crosses your defined risk threshold
- **Audit Export** — One-click PDF reports per vendor, structured for ISO 27001 Annex A and Cyber Essentials reviews
- **Exposed Infrastructure Detection** — Shodan integration flags dangerous open ports (RDP, SMB, MongoDB, etc.)

---

## 🛠️ Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Backend       | Python, FastAPI, SQLAlchemy, APScheduler                |
| Database      | SQLite                                                  |
| Frontend      | React, Vite, TailwindCSS, Recharts                      |
| Intelligence  | HIBP API, NVD/NIST API, Companies House API, Shodan API |
| PDF Export    | ReportLab                                               |
| Auth / Alerts | Gmail SMTP via App Password                             |

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
│   ├── main.py              # FastAPI app entry point
│   ├── models.py            # SQLAlchemy DB models
│   ├── database.py          # DB connection and session
│   ├── scheduler.py         # 24hr background scan scheduler
│   ├── routers/
│   │   ├── vendors.py       # Vendor CRUD endpoints
│   │   ├── intelligence.py  # Scan trigger endpoints
│   │   └── export.py        # PDF export endpoint
│   └── services/
│       ├── scanner.py       # Scan orchestrator
│       ├── hibp.py          # HIBP breach intelligence
│       ├── nvd.py           # NVD CVE intelligence
│       ├── companies_house.py # UK governance checks
│       ├── shodan_service.py  # Exposed infrastructure checks
│       ├── alerts.py        # Email alert engine
│       └── pdf_export.py    # ReportLab PDF generator
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx    # Main vendor overview
        │   └── VendorDetail.jsx # Per-vendor risk detail
        ├── components/
        │   ├── VendorCard.jsx      # Risk score card
        │   ├── ScoreChart.jsx      # Drift timeline chart
        │   ├── EventFeed.jsx       # Risk events list
        │   └── AddVendorModal.jsx  # Add vendor form
        └── api/client.js          # Axios API client
```

---

## ⚙️ Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- API keys for: NVD, Companies House, Shodan, NewsAPI

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
NEWS_API_KEY=your_key
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

Risk scores are calculated by aggregating weighted severity events across all intelligence sources:

| Severity | Weight    |
| -------- | --------- |
| CRITICAL | 25 points |
| HIGH     | 15 points |
| MEDIUM   | 7 points  |
| LOW      | 2 points  |

Scores are capped at 100. Vendors scoring ≥70 trigger email alerts.

---

## 💡 Motivation

Built from direct experience managing 50+ vendor audits annually. Traditional GRC tooling (Vanta, SecurityScorecard) is enterprise-priced and reactive. VenderScope is open-source, UK-aware, and continuously passive — it watches your vendors so you don't have to.

---

## 📄 Roadmap

- [x] Multi-source passive intelligence engine
- [x] Risk score drift timeline
- [x] Companies House UK integration
- [x] Email alert engine
- [x] PDF audit export (ISO 27001 ready)
- [x] Shodan exposed infrastructure detection
- [ ] EPSS exploit probability scoring
- [ ] NewsAPI vendor reputation monitoring
- [ ] Deployment (Render + Vercel)
- [ ] Multi-user support

---

## 👤 Author

**Syed Zarak Hassan**
Compliance Analyst & MSc Cyber Security Student
[LinkedIn](https://linkedin.com/in/zarak-hassan7) · [GitHub](https://github.com/darkyzowo)

NOTE:
\_VenderScope is an independent open-source project. Data is sourced from public APIs and should be reviewed by a qualified security professional.
