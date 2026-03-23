# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| v2.x (current) | ✅ |
| v1.x | ❌ No longer maintained |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in VenderScope, please report it responsibly:

**Email:** [your-security-email@domain.com]
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
- JWT tokens used for session management with short expiry windows
- Refresh tokens stored in httpOnly, Secure, SameSite=Strict cookies — inaccessible to JavaScript
- Brute force protection on all authentication endpoints
- Account enumeration prevention — login errors never reveal whether an email exists

### Authorisation
- Every API endpoint is protected by authentication middleware
- All database queries are scoped to the authenticated user's ID
- Resources return 404 (not 403) for unauthorised access to prevent existence enumeration
- Vendor IDs are UUIDs — not sequential integers

### Data in Transit
- All traffic served over HTTPS (TLS 1.2+)
- HTTP Strict Transport Security (HSTS) enforced
- CORS restricted to known frontend origins only

### Data at Rest
- Database encrypted at rest (PostgreSQL on Render)
- No sensitive data stored in application logs
- Secrets managed via environment variables — never committed to source code

### Server-Side Request Forgery (SSRF) Protection
- All user-supplied URLs (webhook destinations) are validated against:
  - HTTPS scheme enforcement
  - RFC1918 private range blocklist (10.x, 172.16–31.x, 192.168.x)
  - Loopback blocklist (127.x, ::1)
  - Cloud metadata endpoint blocklist (169.254.169.254)
- Outbound HTTP requests use strict timeouts and limited redirect following

### Dependency Security
- Dependencies reviewed before addition
- `npm audit` and `pip-audit` run before every release
- Dependabot enabled for automated vulnerability alerts

### Rate Limiting
- Authentication endpoints: 5 requests per minute per IP
- Registration: 3 requests per hour per IP
- Scan endpoints: limited to prevent API quota abuse
- All limits enforced at the application layer via SlowAPI

### Audit Logging
- All authentication events (login, logout, failed attempts) are logged with IP and timestamp
- All state-changing operations (vendor add/delete, scan triggers, exports) are recorded
- Logs contain no sensitive data (no passwords, no tokens, no personal data beyond user ID and IP)

---

## Known Limitations

- **Demo instance:** The public demo at venderscope.vercel.app uses a shared database. Do not store sensitive vendor information there.
- **Email alerts:** Currently use SMTP in development. Production deployments should configure Resend (HTTP API) via the `RESEND_API_KEY` environment variable.
- **Self-hosted deployments:** Security of self-hosted instances is the responsibility of the operator.

---

## Security Hall of Fame

We thank the following researchers for responsible disclosure:

_(None yet — be the first)_
