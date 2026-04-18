import smtplib
import os
import httpx
from html import escape as _html_escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr
from config import get_primary_frontend_url

GMAIL_ADDRESS   = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASS  = os.getenv("GMAIL_APP_PASSWORD")
ALERT_THRESHOLD = float(os.getenv("ALERT_THRESHOLD", 70))
FRONTEND_URL    = get_primary_frontend_url()
RESEND_API_KEY  = os.getenv("RESEND_API_KEY")
RESEND_FROM     = os.getenv("RESEND_FROM_EMAIL", "VenderScope <alerts@venderscope.app>")
EMAIL_ENABLED   = os.getenv("EMAIL_ENABLED", "1") != "0"

_RESERVED_TEST_DOMAINS = {
    "example.com",
    "example.net",
    "example.org",
    "test",
    "invalid",
    "localhost",
}


# ── Transport layer ──────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, html: str) -> None:
    """Dispatch via Resend if key + domain are configured, otherwise Gmail SMTP."""
    if not EMAIL_ENABLED:
        print(f"[Alerts] Email disabled — skipping '{subject}' to {to}")
        return
    if _is_non_deliverable_test_address(to):
        print(f"[Alerts] Skipping reserved/test email address: {to}")
        return
    if RESEND_API_KEY and _resend_domain_configured():
        _send_via_resend(to, subject, html)
    elif GMAIL_ADDRESS and GMAIL_APP_PASS:
        _send_via_gmail(to, subject, html)
    else:
        print("[Alerts] No email provider ready — skipping. (Add verified Resend domain or Gmail creds.)")


def _is_non_deliverable_test_address(address: str) -> bool:
    email = parseaddr(address)[1].strip().lower()
    if "@" not in email:
        return True
    domain = email.split("@", 1)[1]
    return _is_reserved_test_domain(domain)


def _is_reserved_test_domain(domain: str) -> bool:
    domain = domain.strip().lower()
    return (
        domain in _RESERVED_TEST_DOMAINS
        or domain.endswith(".example")
        or domain.endswith(".invalid")
        or domain.endswith(".test")
        or domain.endswith(".localhost")
    )


def _resend_domain_configured() -> bool:
    """Returns True only if RESEND_FROM_EMAIL uses a custom domain (not the placeholder)."""
    placeholder_domains = {"venderscope.app", "resend.dev", "example.com"}
    try:
        domain = RESEND_FROM.split("@")[-1].rstrip(">").strip().lower()
        return domain not in placeholder_domains
    except Exception:
        return False


def _send_via_resend(to: str, subject: str, html: str) -> None:
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": RESEND_FROM, "to": [to], "subject": subject, "html": html},
            timeout=15,
        )
        resp.raise_for_status()
        print(f"[Alerts] Resend delivered to {to}")
    except httpx.HTTPStatusError as e:
        print(f"[Alerts] Resend HTTP error {e.response.status_code}: {e.response.text}")
    except Exception as e:
        print(f"[Alerts] Resend error: {e}")


def _send_via_gmail(to: str, subject: str, html: str) -> None:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = GMAIL_ADDRESS
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            server.sendmail(GMAIL_ADDRESS, to, msg.as_string())
        print(f"[Alerts] Gmail delivered to {to}")
    except smtplib.SMTPAuthenticationError:
        print("[Alerts] Gmail auth failed — check GMAIL_APP_PASSWORD in .env")
    except Exception as e:
        print(f"[Alerts] Gmail error: {e}")


# ── Email templates ──────────────────────────────────────────────────────────

def send_welcome_email(recipient_email: str) -> None:
    """Send a confirmation email after successful registration."""
    html = f"""
    <html>
    <body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#1a1d27;border-radius:12px;
                  border:1px solid #374151;overflow:hidden;">
        <div style="padding:28px 32px;border-bottom:1px solid #374151;">
          <h1 style="margin:0;color:#6366f1;font-size:22px;">
            Vender<span style="color:#e2e8f0">Scope</span>
          </h1>
        </div>
        <div style="padding:28px 32px;">
          <h2 style="color:#e2e8f0;margin-top:0;">Welcome to VenderScope</h2>
          <p style="color:#94a3b8;">
            Your account has been created successfully. You can now add vendors and
            start monitoring their risk scores across breach data, CVEs, infrastructure
            exposure, and compliance signals.
          </p>
          <div style="margin-top:24px;text-align:center;">
            <a href="{FRONTEND_URL}"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;
                      border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              Go to Dashboard →
            </a>
          </div>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #374151;">
          <p style="margin:0;color:#6b7280;font-size:11px;">
            VenderScope · Continuous Passive Vendor Risk Intelligence
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    _send_email(recipient_email, "Welcome to VenderScope", html)


def send_alert_email(
    vendor_name: str,
    domain: str,
    score: float,
    events: list,
    vendor_id: int = None,
    recipient_email: str = None,
) -> None:
    """Send a risk alert to the vendor owner when their score exceeds the threshold."""
    if score < ALERT_THRESHOLD:
        return

    to = recipient_email
    if not to:
        print(f"[Alerts] No vendor owner recipient for {vendor_name} — skipping alert email.")
        return
    if _is_reserved_test_domain(domain):
        print(f"[Alerts] Reserved/test vendor domain for {vendor_name} ({domain}) — skipping alert email.")
        return

    print(f"[Alerts] Sending alert for {vendor_name} (score: {score}) → {to}")
    # Plain-text subject — do NOT HTML-escape (would show &amp; in email subject)
    subject = f"VenderScope Alert — {vendor_name} Risk Score: {score}/100"

    # Escape all user-supplied and external-API data before embedding in HTML
    safe_vendor_name = _html_escape(vendor_name)
    safe_domain      = _html_escape(domain)

    sev_order  = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    def _event_value(evt, key: str, default: str = ""):
        if isinstance(evt, dict):
            return evt.get(key, default)
        return getattr(evt, key, default)

    top_events = sorted(events, key=lambda e: sev_order.get(_event_value(e, "severity", "LOW"), 4))[:10]

    label_color = "#dc2626" if score >= 85 else "#ea580c"
    risk_label  = "HIGH RISK" if score >= 70 else "MEDIUM RISK"

    event_rows = ""
    for evt in top_events:
        severity = _event_value(evt, "severity", "LOW")
        color = {"CRITICAL": "#dc2626", "HIGH": "#ea580c",
                 "MEDIUM": "#ca8a04", "LOW": "#16a34a"}.get(severity, "#6b7280")
        event_rows += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2d3748;color:#94a3b8;">{_html_escape(_event_value(evt, "source"))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2d3748;color:#e2e8f0;">{_html_escape(_event_value(evt, "title"))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2d3748;font-weight:bold;color:{color};">{_html_escape(severity)}</td>
        </tr>"""

    html = f"""
    <html>
    <body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;">
      <div style="max-width:620px;margin:32px auto;background:#1a1d27;border-radius:12px;
                  border:1px solid #374151;overflow:hidden;">
        <div style="padding:28px 32px;border-bottom:1px solid #374151;">
          <h1 style="margin:0;color:#6366f1;font-size:22px;">
            Vender<span style="color:#e2e8f0">Scope</span>
            <span style="font-size:14px;font-weight:normal;color:#94a3b8;margin-left:8px;">Risk Alert</span>
          </h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#94a3b8;margin-top:0;">
            A vendor has exceeded your risk threshold of
            <strong style="color:#fbbf24">{int(ALERT_THRESHOLD)}</strong>.
          </p>
          <div style="background:#0f1117;border-radius:10px;padding:24px;text-align:center;margin:20px 0;">
            <div style="font-size:52px;font-weight:bold;color:{label_color};line-height:1;">{score}</div>
            <div style="color:{label_color};font-size:13px;font-weight:bold;letter-spacing:2px;margin-top:4px;">{risk_label}</div>
            <div style="color:#e2e8f0;font-size:16px;margin-top:8px;">
              <strong>{safe_vendor_name}</strong>
              <span style="color:#6b7280;font-size:13px;margin-left:6px;">{safe_domain}</span>
            </div>
          </div>
          <p style="color:#94a3b8;font-size:13px;">
            This score is a weighted average of the top detected risk signals across
            HIBP breach data, NVD/NIST CVEs, Companies House governance signals,
            and Shodan infrastructure exposure.
          </p>
          <h3 style="color:#e2e8f0;font-size:14px;margin-bottom:8px;">Top Risk Events</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;background:#0f1117;border-radius:8px;">
            <thead>
              <tr style="background:#111827;">
                <th style="padding:10px 12px;text-align:left;color:#6b7280;">Source</th>
                <th style="padding:10px 12px;text-align:left;color:#6b7280;">Event</th>
                <th style="padding:10px 12px;text-align:left;color:#6b7280;">Severity</th>
              </tr>
            </thead>
            <tbody>{event_rows}</tbody>
          </table>
          <div style="margin-top:24px;text-align:center;">
            <a href="{FRONTEND_URL}/vendor/{vendor_id if vendor_id else ''}"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;
                      border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              View {safe_vendor_name} Risk Report →
            </a>
          </div>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #374151;">
          <p style="margin:0;color:#6b7280;font-size:11px;">
            VenderScope · Continuous Passive Vendor Risk Intelligence ·
            Alert triggered because score exceeded threshold of {int(ALERT_THRESHOLD)}.
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    _send_email(to, subject, html)
