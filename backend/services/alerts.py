import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

GMAIL_ADDRESS    = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASS   = os.getenv("GMAIL_APP_PASSWORD")
ALERT_THRESHOLD  = float(os.getenv("ALERT_THRESHOLD", 70))
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:5173")


def send_alert_email(vendor_name: str, domain: str, score: float, events: list, vendor_id: int = None):
    """
    Sends a risk alert email via SendGrid HTTP API.
    Works on Render free tier — no SMTP ports needed.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        print("[Alerts] Missing GMAIL_ADDRESS or GMAIL_APP_PASSWORD — skipping.")
        return

    if score < ALERT_THRESHOLD:
        return

    print(f"[Alerts] Sending alert for {vendor_name} (score: {score})...")
    subject = f"🚨 VenderScope Alert — {vendor_name} Risk Score: {score}/100"

    sev_order  = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    top_events = sorted(events, key=lambda e: sev_order.get(e.severity, 4))[:10]

    label_color = "#dc2626" if score >= 85 else "#ea580c"
    risk_label  = "HIGH RISK" if score >= 70 else "MEDIUM RISK"

    event_rows = ""
    for evt in top_events:
        color = {"CRITICAL": "#dc2626", "HIGH": "#ea580c",
                 "MEDIUM": "#ca8a04", "LOW": "#16a34a"}.get(evt.severity, "#6b7280")
        event_rows += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2d3748;color:#94a3b8;">{evt.source}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2d3748;color:#e2e8f0;">{evt.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2d3748;font-weight:bold;color:{color};">{evt.severity}</td>
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
              <strong>{vendor_name}</strong>
              <span style="color:#6b7280;font-size:13px;margin-left:6px;">{domain}</span>
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
              View {vendor_name} Risk Report →
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

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = GMAIL_ADDRESS
        msg["To"]      = GMAIL_ADDRESS
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            server.sendmail(GMAIL_ADDRESS, GMAIL_ADDRESS, msg.as_string())

        print(f"[Alerts] ✅ Email sent for {vendor_name} (score: {score})")

    except smtplib.SMTPAuthenticationError:
        print("[Alerts] ❌ Auth failed — check GMAIL_APP_PASSWORD in .env")
    except Exception as e:
        print(f"[Alerts] ❌ Error: {e}")