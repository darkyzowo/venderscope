import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

GMAIL_ADDRESS    = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASS   = os.getenv("GMAIL_APP_PASSWORD")
ALERT_THRESHOLD  = float(os.getenv("ALERT_THRESHOLD", 70))


def send_alert_email(vendor_name: str, domain: str, score: float, events: list):
    """
    Sends a risk alert email when a vendor's score crosses the threshold.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        print("[Alerts] No Gmail credentials found, skipping email.")
        return

    if score < ALERT_THRESHOLD:
        return

    subject = f"🚨 VenderScope Alert — {vendor_name} Risk Score: {score}/100"

    # Build event rows for the email
    event_rows = ""
    for evt in events[:10]:  # cap at 10 in email
        color = {
            "CRITICAL": "#dc2626",
            "HIGH":     "#ea580c",
            "MEDIUM":   "#ca8a04",
            "LOW":      "#16a34a",
        }.get(evt.severity, "#6b7280")

        event_rows += f"""
        <tr>
            <td style="padding:8px;border-bottom:1px solid #374151;">{evt.source}</td>
            <td style="padding:8px;border-bottom:1px solid #374151;">{evt.title}</td>
            <td style="padding:8px;border-bottom:1px solid #374151;color:{color};font-weight:bold;">{evt.severity}</td>
        </tr>
        """

    html = f"""
    <html><body style="font-family:sans-serif;background:#0f1117;color:#e2e8f0;padding:32px;">
        <div style="max-width:600px;margin:0 auto;background:#1a1d27;border-radius:12px;padding:32px;border:1px solid #374151;">
            <h1 style="color:#6366f1;margin-top:0;">VenderScope<span style="color:#e2e8f0"> Alert</span></h1>
            <p style="color:#94a3b8;">A vendor has exceeded your risk threshold of <strong style="color:#fbbf24">{ALERT_THRESHOLD}</strong>.</p>

            <div style="background:#0f1117;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
                <div style="font-size:48px;font-weight:bold;color:#dc2626;">{score}</div>
                <div style="color:#94a3b8;">Risk Score for <strong style="color:#e2e8f0">{vendor_name}</strong> ({domain})</div>
            </div>

            <h3 style="color:#e2e8f0;">Risk Events Detected</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="background:#0f1117;">
                        <th style="padding:8px;text-align:left;color:#94a3b8;">Source</th>
                        <th style="padding:8px;text-align:left;color:#94a3b8;">Event</th>
                        <th style="padding:8px;text-align:left;color:#94a3b8;">Severity</th>
                    </tr>
                </thead>
                <tbody>{event_rows}</tbody>
            </table>

            <p style="margin-top:24px;color:#6b7280;font-size:12px;">
                Sent by VenderScope · Continuous Vendor Risk Intelligence
            </p>
        </div>
    </body></html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = GMAIL_ADDRESS
        msg["To"]      = GMAIL_ADDRESS
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            server.sendmail(GMAIL_ADDRESS, GMAIL_ADDRESS, msg.as_string())

        print(f"[Alerts] Email sent for {vendor_name} (score: {score})")

    except Exception as e:
        print(f"[Alerts] Failed to send email: {e}")