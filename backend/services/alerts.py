import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

GMAIL_ADDRESS   = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASS  = os.getenv("GMAIL_APP_PASSWORD")
ALERT_THRESHOLD = float(os.getenv("ALERT_THRESHOLD", 70))


def send_alert_email(vendor_name: str, domain: str, score: float, events: list):
    """
    Sends a risk alert email when a vendor's score crosses the threshold.
    Uses STARTTLS on port 587 — works on Render's free tier unlike SSL on 465.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        print("[Alerts] No Gmail credentials found — skipping.")
        return

    if score < ALERT_THRESHOLD:
        print(f"[Alerts] {vendor_name} score {score} below threshold {ALERT_THRESHOLD} — no email.")
        return

    print(f"[Alerts] Sending alert for {vendor_name} (score: {score})...")

    subject = f"🚨 VenderScope Alert — {vendor_name} Risk Score: {score}/100"

    # Sort events by severity for the email
    sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    top_events = sorted(events, key=lambda e: sev_order.get(e.severity, 4))[:10]

    event_rows = ""
    for evt in top_events:
        color = {
            "CRITICAL": "#dc2626",
            "HIGH":     "#ea580c",
            "MEDIUM":   "#ca8a04",
            "LOW":      "#16a34a",
        }.get(evt.severity, "#6b7280")
        event_rows += f"""
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #2d3748;color:#94a3b8;">{evt.source}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2d3748;color:#e2e8f0;">{evt.title}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2d3748;font-weight:bold;color:{color};">{evt.severity}</td>
        </tr>
        """

    # Risk label
    risk_label = "HIGH RISK" if score >= 70 else "MEDIUM RISK"
    label_color = "#dc2626" if score >= 85 else "#ea580c"

    html = f"""
    <html>
    <body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;">
      <div style="max-width:620px;margin:32px auto;background:#1a1d27;border-radius:12px;
                  border:1px solid #374151;overflow:hidden;">

        <!-- Header -->
        <div style="padding:28px 32px;border-bottom:1px solid #374151;">
          <h1 style="margin:0;color:#6366f1;font-size:22px;">
            Vender<span style="color:#e2e8f0">Scope</span>
            <span style="font-size:14px;font-weight:normal;color:#94a3b8;margin-left:8px;">Risk Alert</span>
          </h1>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="color:#94a3b8;margin-top:0;">
            A vendor in your estate has exceeded your configured risk threshold of
            <strong style="color:#fbbf24">{int(ALERT_THRESHOLD)}</strong>.
          </p>

          <!-- Score block -->
          <div style="background:#0f1117;border-radius:10px;padding:24px;text-align:center;margin:20px 0;">
            <div style="font-size:52px;font-weight:bold;color:{label_color};line-height:1;">
              {score}
            </div>
            <div style="color:{label_color};font-size:13px;font-weight:bold;
                        letter-spacing:2px;margin-top:4px;">{risk_label}</div>
            <div style="color:#e2e8f0;font-size:16px;margin-top:8px;">
              <strong>{vendor_name}</strong>
              <span style="color:#6b7280;font-size:13px;margin-left:6px;">{domain}</span>
            </div>
          </div>

          <p style="color:#94a3b8;font-size:13px;">
            This score is a weighted average of the top detected risk signals across
            HIBP breach data, NVD/NIST CVEs, Companies House governance signals,
            and Shodan infrastructure exposure. Scores ≥70 are flagged as High Risk.
          </p>

          <!-- Events table -->
          <h3 style="color:#e2e8f0;font-size:14px;margin-bottom:8px;">
            Top Risk Events Detected
          </h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;
                        background:#0f1117;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#111827;">
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Source</th>
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Event</th>
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Severity</th>
              </tr>
            </thead>
            <tbody>{event_rows}</tbody>
          </table>

          <!-- CTA -->
          <div style="margin-top:24px;text-align:center;">
            <a href="https://venderscope.vercel.app"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;
                      border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              View Full Report in VenderScope →
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px;border-top:1px solid #374151;">
          <p style="margin:0;color:#6b7280;font-size:11px;">
            VenderScope · Continuous Passive Vendor Risk Intelligence ·
            You are receiving this because a vendor exceeded your alert threshold of {int(ALERT_THRESHOLD)}.
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

        # Use STARTTLS on port 587 — works on Render free tier
        # (port 465 SSL is often blocked by cloud hosting providers)
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            server.sendmail(GMAIL_ADDRESS, GMAIL_ADDRESS, msg.as_string())

        print(f"[Alerts] ✅ Email sent for {vendor_name} (score: {score})")

    except smtplib.SMTPAuthenticationError:
        print("[Alerts] ❌ Authentication failed — check GMAIL_APP_PASSWORD in Render env vars")
    except smtplib.SMTPException as e:
        print(f"[Alerts] ❌ SMTP error: {e}")
    except Exception as e:
        print(f"[Alerts] ❌ Unexpected error: {e}")