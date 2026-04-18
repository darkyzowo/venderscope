import io
import re
from datetime import datetime, timedelta, timezone
from xml.sax.saxutils import escape as _xml_escape
from services.risk_context import compute_effective_score, SENSITIVITY_LABELS
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER

# Colours
INDIGO  = colors.HexColor("#6366f1")
RED     = colors.HexColor("#dc2626")
ORANGE  = colors.HexColor("#ea580c")
YELLOW  = colors.HexColor("#ca8a04")
GREEN   = colors.HexColor("#16a34a")
GREY    = colors.HexColor("#9ca3af")
LIGHT   = colors.HexColor("#f3f4f6")
DARK    = colors.HexColor("#1e293b")
WHITE   = colors.white

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

def sev_color(sev: str):
    return {"CRITICAL": RED, "HIGH": ORANGE, "MEDIUM": YELLOW, "LOW": GREEN}.get(sev, GREY)

def parse_epss(desc: str) -> float:
    m = re.search(r'\[EPSS: ([\d.]+)%', desc or '')
    return float(m.group(1)) if m else 0.0

def sort_events(events):
    return sorted(events, key=lambda e: (
        SEVERITY_ORDER.get(e.severity, 4),
        -parse_epss(e.description)
    ))

def generate_vendor_pdf(vendor, events: list, history: list, notes: list = None, acceptances: list = None) -> bytes:
    buf     = io.BytesIO()
    W, H    = A4
    margin  = 20 * mm
    usable  = W - 2 * margin

    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=margin, rightMargin=margin,
                            topMargin=margin, bottomMargin=margin)

    # Styles
    title_s  = ParagraphStyle("t",  fontSize=20, leading=26, textColor=INDIGO, spaceAfter=8, fontName="Helvetica-Bold")
    meta_s   = ParagraphStyle("m",  fontSize=8,  textColor=GREY,   spaceAfter=14)
    h2_s     = ParagraphStyle("h2", fontSize=12, textColor=DARK,   spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    body_s   = ParagraphStyle("b",  fontSize=9,  textColor=DARK,   spaceAfter=4)
    score_s  = ParagraphStyle("sc", fontSize=42, leading=54, alignment=TA_CENTER, fontName="Helvetica-Bold")
    label_s  = ParagraphStyle("sl", fontSize=13, leading=18, alignment=TA_CENTER, fontName="Helvetica-Bold")
    trend_s  = ParagraphStyle("tr", fontSize=8,  leading=12, alignment=TA_CENTER, textColor=GREY)
    cell_s   = ParagraphStyle("c",  fontSize=8,  textColor=DARK,   leading=10)
    footer_s = ParagraphStyle("f",  fontSize=7,  textColor=GREY,   spaceBefore=12)

    score            = vendor.risk_score
    score_color      = RED if score >= 70 else YELLOW if score >= 35 else GREEN
    risk_label       = "HIGH RISK" if score >= 70 else "MEDIUM RISK" if score >= 35 else "LOW RISK"
    sensitivity      = vendor.data_sensitivity or "standard"
    sensitivity_label = SENSITIVITY_LABELS.get(sensitivity, "Standard / Unknown")
    effective        = compute_effective_score(score, sensitivity)
    eff_color        = RED if effective >= 70 else YELLOW if effective >= 35 else GREEN
    eff_label        = "HIGH RISK" if effective >= 70 else "MEDIUM RISK" if effective >= 35 else "LOW RISK"
    events           = sort_events(events)

    story = []

    # Header
    story.append(Paragraph("VenderScope — Vendor Risk Audit Report", title_s))
    story.append(Paragraph(
        f"Generated: {_utc_now().strftime('%d %B %Y, %H:%M UTC')}  |  "
        f"ISO 27001 Annex A / Cyber Essentials compliance review", meta_s))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceAfter=8))

    # Vendor summary table
    story.append(Paragraph("Vendor Summary", h2_s))
    rows = [
        ["Vendor Name",       _xml_escape(vendor.name)],
        ["Domain",            _xml_escape(vendor.domain)],
        ["Last Scanned",      vendor.last_scanned.strftime('%d %B %Y, %H:%M UTC') if vendor.last_scanned else "Never"],
        ["Data Sensitivity",  sensitivity_label],
        ["Technical Score",   str(int(score))],
        ["Effective Exposure", f"{effective}  ({eff_label})"],
    ]
    if vendor.company_number:
        rows.insert(2, ["Companies House", _xml_escape(vendor.company_number)])

    # Review schedule rows
    if vendor.review_interval_days:
        interval_label = {30: "Monthly (30 days)", 60: "Every 60 days", 90: "Quarterly (90 days)",
                          180: "Every 180 days", 365: "Annually (365 days)"}.get(
            vendor.review_interval_days, f"Every {vendor.review_interval_days} days")
        rows.append(["Review Interval", interval_label])
        if vendor.last_reviewed_at:
            reviewed_at_utc = _as_utc(vendor.last_reviewed_at)
            rows.append(["Last Reviewed", reviewed_at_utc.strftime('%d %B %Y')])
            due_dt = reviewed_at_utc + timedelta(days=vendor.review_interval_days)
            now_utc = _utc_now()
            if due_dt < now_utc:
                diff_days = int((now_utc - due_dt).total_seconds() / 86400)
                rows.append(["Review Status", f"OVERDUE by {diff_days} day(s)"])
            else:
                rows.append(["Next Review Due", due_dt.strftime('%d %B %Y')])
        else:
            rows.append(["Review Status", "Never reviewed"])

    col_w = [45*mm, usable - 45*mm]
    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ("FONTNAME",        (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",        (0,0), (-1,-1), 9),
        ("BACKGROUND",      (0,0), (0,-1), LIGHT),
        ("GRID",            (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS",  (0,0), (-1,-1), [WHITE, LIGHT]),
        ("PADDING",         (0,0), (-1,-1), 6),
        ("VALIGN",          (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(t)

    # Risk score block
    story.append(Paragraph("Risk Score", h2_s))

    hex_col = score_color.hexval()[2:]
    trend_text = ""
    if history:
        first = history[0].score
        last  = history[-1].score
        trend = "↑ Increasing" if last > first else "↓ Decreasing" if last < first else "→ Stable"
        trend_text = f"Score Trend: {trend}  |  {first} → {last}  |  {len(history)} scan(s) recorded"

    story.append(Spacer(1, 14))
    story.append(Paragraph(f'<font color="#{hex_col}">{int(score)}</font>', score_s))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f'<font color="#{hex_col}">{risk_label}</font>', label_s))
    story.append(Spacer(1, 8))
    story.append(Paragraph(trend_text, trend_s))
    story.append(Spacer(1, 14))

    # Risk events — sorted by severity + EPSS
    story.append(Paragraph(f"Risk Events  (top {len(events)} by severity &amp; exploitability)", h2_s))

    if not events:
        story.append(Paragraph("No risk events detected.", body_s))
    else:
        cw  = [22*mm, usable - 22*mm - 22*mm - 24*mm, 22*mm, 24*mm]
        hdr = [Paragraph(f"<b>{h}</b>", cell_s) for h in ["Source", "Event", "Severity", "Detected"]]
        data = [hdr]
        for evt in events:
            data.append([
                Paragraph(_xml_escape(evt.source), cell_s),
                Paragraph(_xml_escape(evt.title),  cell_s),
                Paragraph(f"<b>{_xml_escape(evt.severity)}</b>", ParagraphStyle(
                    "sev", fontSize=8, textColor=sev_color(evt.severity), fontName="Helvetica-Bold")),
                Paragraph(evt.detected_at.strftime('%d/%m/%Y') if evt.detected_at else "N/A", cell_s),
            ])

        tbl = Table(data, colWidths=cw, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",      (0,0), (-1,0), DARK),
            ("TEXTCOLOR",       (0,0), (-1,0), WHITE),
            ("FONTSIZE",        (0,0), (-1,-1), 8),
            ("GRID",            (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS",  (0,1), (-1,-1), [WHITE, LIGHT]),
            ("PADDING",         (0,0), (-1,-1), 5),
            ("VALIGN",          (0,0), (-1,-1), "TOP"),
        ]))
        story.append(tbl)

    # Risk Acceptances
    if acceptances:
        story.append(Paragraph("Risk Acceptances", h2_s))
        AMBER = colors.HexColor("#d97706")
        acc_cw = [25*mm, 20*mm, usable - 25*mm - 20*mm - 24*mm - 22*mm - 20*mm, 24*mm, 22*mm, 20*mm]
        acc_hdr = [Paragraph(f"<b>{h}</b>", cell_s) for h in
                   ["Finding", "Type", "Justification", "Reviewer", "Expires", "Status"]]
        acc_data = [acc_hdr]
        for acc in acceptances:
            exp_dt = _as_utc(acc.expires_at)
            is_active = exp_dt > _utc_now() if exp_dt else False
            status_para = Paragraph(
                "<b>ACTIVE</b>" if is_active else "<b>EXPIRED</b>",
                ParagraphStyle("acc_st", fontSize=8, fontName="Helvetica-Bold",
                               textColor=AMBER if is_active else GREY)
            )
            acc_data.append([
                Paragraph(_xml_escape(acc.finding_ref or ""), cell_s),
                Paragraph(_xml_escape(acc.finding_type or ""), cell_s),
                Paragraph(_xml_escape(acc.justification or ""), cell_s),
                Paragraph(_xml_escape(acc.reviewer or ""), cell_s),
                Paragraph(exp_dt.strftime('%d/%m/%Y') if exp_dt else "N/A", cell_s),
                status_para,
            ])
        acc_tbl = Table(acc_data, colWidths=acc_cw, repeatRows=1)
        acc_tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0,0), (-1,0), DARK),
            ("TEXTCOLOR",      (0,0), (-1,0), WHITE),
            ("FONTSIZE",       (0,0), (-1,-1), 8),
            ("GRID",           (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, LIGHT]),
            ("PADDING",        (0,0), (-1,-1), 5),
            ("VALIGN",         (0,0), (-1,-1), "TOP"),
        ]))
        story.append(acc_tbl)

    # Analyst Notes
    if notes:
        story.append(Paragraph("Analyst Notes", h2_s))
        note_rows = []
        for n in notes:
            date_str = n.created_at.strftime('%d/%m/%Y') if n.created_at else ''
            note_rows.append([
                Paragraph(date_str, cell_s),
                Paragraph(_xml_escape(str(n.content)), cell_s),
            ])
        note_tbl = Table(note_rows, colWidths=[22*mm, usable - 22*mm])
        note_tbl.setStyle(TableStyle([
            ("FONTSIZE",       (0, 0), (-1, -1), 8),
            ("GRID",           (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
            ("PADDING",        (0, 0), (-1, -1), 5),
            ("VALIGN",         (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(note_tbl)

    # Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT, spaceBefore=16, spaceAfter=6))
    story.append(Paragraph(
        "VenderScope  ·  Continuous Passive Vendor Risk Intelligence  ·  "
        "Data sources: HIBP, NVD (NIST), Companies House, Shodan  ·  "
        "This report should be reviewed by a qualified security professional.",
        footer_s))

    doc.build(story)
    return buf.getvalue()


def generate_guest_pdf(name: str, domain: str, score: float, events: list[dict]) -> bytes:
    """
    Guest variant — CVE-only data, clearly watermarked.
    ALL user-supplied strings are XML-escaped before reaching ReportLab.
    """
    buf    = io.BytesIO()
    W, H   = A4
    margin = 20 * mm
    usable = W - 2 * margin

    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=margin, rightMargin=margin,
                            topMargin=margin, bottomMargin=margin)

    title_s  = ParagraphStyle("gt",  fontSize=20, leading=26, textColor=INDIGO, spaceAfter=8,  fontName="Helvetica-Bold")
    meta_s   = ParagraphStyle("gm",  fontSize=8,  textColor=GREY,   spaceAfter=14)
    h2_s     = ParagraphStyle("gh2", fontSize=12, textColor=DARK,   spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    cell_s   = ParagraphStyle("gc",  fontSize=8,  textColor=DARK,   leading=10)
    warn_s   = ParagraphStyle("gw",  fontSize=9,  textColor=colors.HexColor("#92400e"),
                               spaceAfter=6, spaceBefore=6, fontName="Helvetica-Bold")
    footer_s = ParagraphStyle("gf",  fontSize=7,  textColor=GREY,   spaceBefore=12)

    score_val   = min(max(float(score), 0.0), 100.0)
    score_color = RED if score_val >= 70 else YELLOW if score_val >= 35 else GREEN
    risk_label  = "HIGH RISK" if score_val >= 70 else "MEDIUM RISK" if score_val >= 35 else "LOW RISK"

    safe_name   = _xml_escape(name)
    safe_domain = _xml_escape(domain)

    story = []

    # Header
    story.append(Paragraph("VenderScope — Guest Risk Report (CVEs Only)", title_s))
    story.append(Paragraph(
        f"Generated: {_utc_now().strftime('%d %B %Y, %H:%M UTC')}  |  "
        f"Partial scan — CVE data only", meta_s))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceAfter=8))

    # Guest limitation warning box
    warning_data = [[Paragraph(
        "GUEST REPORT — PARTIAL SCAN. This report contains CVE data only. "
        "Breach history, infrastructure exposure, compliance posture, and vendor "
        "profiling are excluded. The risk score reflects CVEs alone and may be "
        "significantly lower than the actual vendor risk. Create an account for "
        "a full assessment.", warn_s
    )]]
    warn_table = Table(warning_data, colWidths=[usable])
    warn_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#fffbeb")),
        ("BOX",          (0, 0), (-1, -1), 1, colors.HexColor("#f59e0b")),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(warn_table)
    story.append(Spacer(1, 10))

    # Vendor summary
    story.append(Paragraph("Vendor Summary", h2_s))
    rows = [["Vendor Name", safe_name], ["Domain", safe_domain], ["Scan Type", "Guest (CVEs only)"]]
    t = Table(rows, colWidths=[45*mm, usable - 45*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (0, -1), LIGHT),
        ("FONTNAME",     (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    # Score
    story.append(Paragraph("Risk Score (CVEs only)", h2_s))
    story.append(Paragraph(f"{score_val}", ParagraphStyle(
        "gsc2", fontSize=42, leading=54, alignment=TA_CENTER,
        fontName="Helvetica-Bold", textColor=score_color)))
    story.append(Paragraph(risk_label, ParagraphStyle(
        "gsl2", fontSize=13, leading=18, alignment=TA_CENTER,
        fontName="Helvetica-Bold", textColor=score_color)))
    story.append(Spacer(1, 12))

    # Events table
    if events:
        story.append(Paragraph(f"CVE Findings ({len(events)})", h2_s))
        hdr = [
            Paragraph("<b>Source</b>", cell_s),
            Paragraph("<b>CVE / Title</b>", cell_s),
            Paragraph("<b>Severity</b>", cell_s),
        ]
        col_w = [30*mm, usable - 30*mm - 22*mm, 22*mm]
        data  = [hdr]
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        sorted_evts = sorted(events, key=lambda e: sev_order.get(e.get("severity", "LOW"), 4))
        for evt in sorted_evts:
            data.append([
                Paragraph(_xml_escape(str(evt.get("source", ""))), cell_s),
                Paragraph(_xml_escape(str(evt.get("title", ""))),  cell_s),
                Paragraph(f"<b>{_xml_escape(str(evt.get('severity', 'LOW')))}</b>",
                          ParagraphStyle("gsev2", fontSize=8,
                                         textColor=sev_color(evt.get("severity", "LOW")),
                                         fontName="Helvetica-Bold")),
            ])
        tbl = Table(data, colWidths=col_w)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR",      (0, 0), (-1, 0), WHITE),
            ("FONTNAME",       (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",       (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#f8fafc")]),
            ("GRID",           (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("LEFTPADDING",    (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 6),
            ("TOPPADDING",     (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 4),
            ("VALIGN",         (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(tbl)
    else:
        story.append(Paragraph("No CVE findings for this vendor.", cell_s))

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT))
    story.append(Paragraph(
        "Guest report generated by VenderScope · Results not saved · "
        "venderscope.vercel.app", footer_s))

    doc.build(story)
    return buf.getvalue()
