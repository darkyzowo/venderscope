## SESSION START

1. Read tasks/lessons.md — apply all lessons before touching anything
2. Read tasks/todo.md — understand current state
3. If neither exists, create them before starting

---

## PROJECT: VenderScope

Continuous passive vendor risk monitoring platform.
Aggregates breach, CVE, infrastructure, and compliance signals into a weighted risk score per vendor.

**Deployed at:**
- Frontend: Vercel
- Backend: Render free tier (cold start ~50s, keep-alive pings every 10min)

---

## TECH STACK

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, APScheduler, Uvicorn |
| Frontend | React 19, Vite 8, React Router 7, TailwindCSS 3, Recharts, Axios |
| Database | SQLite (`vendorscope.db`) |
| Concurrency | `ThreadPoolExecutor` (not async) for intelligence gathering |
| PDF | ReportLab |
| Scraping | BeautifulSoup4 |
| Rate Limiting | SlowAPI |

---

## PROJECT STRUCTURE

```
VenderScope/
├── backend/
│   ├── main.py               # FastAPI entry point, CORS, rate limiting, scheduler lifespan
│   ├── models.py             # Vendor, RiskEvent, RiskScoreHistory (SQLAlchemy)
│   ├── database.py           # SQLite connection
│   ├── scheduler.py          # 24hr scan job + 10min keep-alive
│   ├── requirements.txt
│   ├── render.yaml           # Render deployment config
│   ├── routers/
│   │   ├── vendors.py        # Vendor CRUD
│   │   ├── intelligence.py   # Scan trigger endpoints
│   │   ├── export.py         # PDF export
│   │   └── quota.py          # Google CSE quota status
│   └── services/
│       ├── scanner.py        # Orchestrator — runs all sources concurrently
│       ├── hibp.py           # HaveIBeenPwned breach data
│       ├── nvd.py            # NIST NVD CVE data
│       ├── companies_house.py# UK governance checks
│       ├── shodan_service.py # Exposed infrastructure
│       ├── compliance_discovery.py # Two-stage compliance scrape + Google CSE
│       ├── quota.py          # Google CSE daily quota tracker (auto-resets)
│       ├── alerts.py         # Gmail email alert engine
│       ├── pdf_export.py     # ReportLab PDF generation
│       └── epss.py           # EPSS exploit probability scoring
├── frontend/
│   ├── vite.config.js        # Proxies /api → localhost:8000
│   ├── src/
│   │   ├── App.jsx           # Router: / → Dashboard, /vendor/:id → VendorDetail
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── VendorDetail.jsx
│   │   ├── components/
│   │   │   ├── VendorCard.jsx
│   │   │   ├── ScoreChart.jsx       # Recharts timeline
│   │   │   ├── EventFeed.jsx
│   │   │   ├── AddVendorModal.jsx
│   │   │   ├── CompliancePanel.jsx
│   │   │   └── QuotaBanner.jsx
│   │   └── api/client.js     # Axios client, base URL from VITE_API_URL
│   ├── .env.local            # VITE_API_URL=http://127.0.0.1:8000/api
│   └── .env.production       # VITE_API_URL=https://venderscope-api.onrender.com/api
├── .env                      # Backend secrets (never commit)
└── vendorscope.db            # SQLite DB
```

---

## HOW TO RUN

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# → http://127.0.0.1:8000
# → http://127.0.0.1:8000/docs  (OpenAPI)
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

**Lint:**
```bash
cd frontend && npm run lint
```

**No automated tests** — verification is manual via `/docs` + browser.

---

## ARCHITECTURE & KEY PATTERNS

### Risk Score Calculation
- Top 5 events weighted: CRITICAL=100, HIGH=70, MEDIUM=40, LOW=15
- Count multiplier up to 1.4x for vendors with many signals
- Capped at 100, stored in `RiskScoreHistory` for timeline chart

### Intelligence Gathering (scanner.py)
- `ThreadPoolExecutor` runs HIBP, NVD, Shodan, Companies House, Compliance simultaneously
- Scan time: ~8–15s on Render, faster locally

### 24-Hour Cache
- `vendor.last_scanned` checked before each scan
- Skip if within 24hrs — use `force=true` to bypass
- Protects API quotas (especially Google CSE: 100 units/day free)

### Two-Stage Compliance Discovery
1. Scrape vendor's own pages (free, no quota)
2. Fallback to Google CSE if cert not found (costs quota)
- Skips stage 2 if daily quota exhausted

### External API Keys (backend .env)
```
NVD_API_KEY
COMPANIES_HOUSE_API_KEY
SHODAN_API_KEY
GOOGLE_CSE_API_KEY
GOOGLE_CSE_ID
GMAIL_ADDRESS
GMAIL_APP_PASSWORD
ALERT_THRESHOLD=70
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./vendorscope.db
```

---

## KNOWN CONSTRAINTS

- **No auth** — single-user, shared demo DB. JWT/OAuth on roadmap.
- **SQLite** — fine for single user, not for multi-user production (PostgreSQL on roadmap)
- **APScheduler in-process** — no Celery/Redis; not suitable for high-volume tasks
- **Render free tier** — cold start ~50s, 0.1 CPU, 512MB RAM
- **Google CSE** — 100 units/day free; quota resets daily
- **Email alerts** — Gmail SMTP only works locally; needs HTTP API for production
- **JS-rendered trust centres** — compliance scraper misses dynamically loaded pages

---

## ROADMAP (pending)

- [ ] Email alerts via HTTP API (production-safe)
- [ ] User authentication (JWT/OAuth)
- [ ] Async task queue (Celery + Redis)
- [ ] PostgreSQL migration
- [ ] Multi-user support
- [ ] NewsAPI integration

---

## WORKFLOW

### 1. Plan First
- Enter plan mode for any non-trivial task (3+ steps)
- Write plan to tasks/todo.md before implementing
- If something goes wrong, STOP and re-plan — never push through

### 2. Subagent Strategy
- Use subagents to keep main context clean
- One task per subagent
- Throw more compute at hard problems

### 3. Self-Improvement Loop
- After any correction: update tasks/lessons.md
- Format: [date] | what went wrong | rule to prevent it
- Review lessons at every session start

### 4. Verification Standard
- Never mark complete without proving it works
- Run tests, check logs, diff behavior
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance
- For non-trivial changes: is there a more elegant solution?
- If a fix feels hacky: rebuild it properly
- Don't over-engineer simple things

### 6. Autonomous Bug Fixing
- When given a bug: just fix it
- Go to logs, find root cause, resolve it
- No hand-holding needed

---

## CORE PRINCIPLES

- Simplicity First — touch minimal code
- No Laziness — root causes only, no temp fixes
- Never Assume — verify paths, APIs, variables before using
- Ask Once — one question upfront if unclear, never interrupt mid-task

---

## TASK MANAGEMENT

1. Plan → tasks/todo.md
2. Verify → confirm before implementing
3. Track → mark complete as you go
4. Explain → high-level summary each step
5. Learn → tasks/lessons.md after corrections

---

## LEARNED

(Claude fills this in over time)
