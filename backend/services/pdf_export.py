from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import io

# Colour palette
INDIGO  = colors.HexColor("#6366f1")
RED     = colors.HexColor("#dc2626")
ORANGE  = colors.HexColor("#ea580c")
YELLOW  = colors.HexColor("#ca8a04")
GREEN   = colors.HexColor("#16a34a")
GREY    = colors.HexColor("#9ca3af")
LIGHT   = colors.HexColor("#f3f4f6")
DARK    = colors.HexColor("#1e293b")
WHITE   = colors.white

def sev_color(sev: str):
    return {"CRITICAL": RED, "HIGH": ORANGE, "MEDIUM": YELLOW, "LOW": GREEN}.get(sev, GREY)

def generate_vendor_pdf(vendor, events: list, history: list) -> bytes:
    buf = io.BytesIO()
    W, H = A4  # 210 x 297mm
    margin = 20 * mm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=margin, bottomMargin=margin
    )

    usable_w = W - 2 * margin  # ~170mm

    # ── Styles ──────────────────────────────────────────────
    title_s  = ParagraphStyle("t",  fontSize=20, textColor=INDIGO,  spaceAfter=10, fontName="Helvetica-Bold")
    meta_s   = ParagraphStyle("m",  fontSize=8,  textColor=GREY,    spaceAfter=14)
    h2_s     = ParagraphStyle("h2", fontSize=12, textColor=DARK,    spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    body_s   = ParagraphStyle("b",  fontSize=9,  textColor=DARK,    spaceAfter=4)
    # leading MUST be set explicitly for large fonts — ReportLab miscalculates
    # bounding boxes when leading is auto-derived for font sizes > ~18pt,
    # causing paragraphs to stack with zero real gap.
    score_s  = ParagraphStyle("sc", fontSize=42, leading=54, alignment=TA_CENTER, fontName="Helvetica-Bold")
    label_s  = ParagraphStyle("sl", fontSize=13, leading=18, alignment=TA_CENTER, fontName="Helvetica-Bold")
    trend_s  = ParagraphStyle("tr", fontSize=8,  leading=12, alignment=TA_CENTER, textColor=GREY)
    cell_s   = ParagraphStyle("c",  fontSize=8,  textColor=DARK,    leading=10)
    footer_s = ParagraphStyle("f",  fontSize=7,  textColor=GREY,    spaceBefore=12)

    score       = vendor.risk_score
    score_color = RED if score >= 70 else YELLOW if score >= 35 else GREEN
    risk_label  = "HIGH RISK" if score >= 70 else "MEDIUM RISK" if score >= 35 else "LOW RISK"

    story = []

    # ── Header ──────────────────────────────────────────────
    story.append(Paragraph("VenderScope — Vendor Risk Audit Report", title_s))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%d %B %Y, %H:%M UTC')}  |  "
        f"ISO 27001 Annex A / Cyber Essentials compliance review",
        meta_s
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceAfter=8))

    # ── Vendor Summary ───────────────────────────────────────
    story.append(Paragraph("Vendor Summary", h2_s))

    rows = [
        ["Vendor Name",  vendor.name],
        ["Domain",       vendor.domain],
        ["Last Scanned", vendor.last_scanned.strftime('%d %B %Y, %H:%M UTC')
                         if vendor.last_scanned else "Never"],
    ]
    if vendor.company_number:
        rows.append(["Companies House", vendor.company_number])

    col_w = [45*mm, usable_w - 45*mm]
    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ("FONTNAME",   (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 9),
        ("TEXTCOLOR",  (0,0), (0,-1), DARK),
        ("BACKGROUND", (0,0), (0,-1), LIGHT),
        ("GRID",       (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [WHITE, LIGHT]),
        ("PADDING",    (0,0), (-1,-1), 6),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(t)

    # ── Risk Score ───────────────────────────────────────────
    story.append(Paragraph("Risk Score", h2_s))

    trend_text = ""
    if history:
        first = history[0].score
        last  = history[-1].score
        trend = "↑ Increasing" if last > first else "↓ Decreasing" if last < first else "→ Stable"
        trend_text = f"Score Trend: {trend}  |  {first} → {last}  |  {len(history)} scan(s) recorded"

    # Spacer is a guaranteed flowable gap — unlike spaceBefore/spaceAfter
    # which can collapse or be ignored by ReportLab's layout engine.
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f'<font color="#{score_color.hexval()[2:]}">{int(score)}</font>', score_s
    ))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        f'<font color="#{score_color.hexval()[2:]}">{risk_label}</font>', label_s
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(trend_text, trend_s))
    story.append(Spacer(1, 14))

    # ── Risk Events ──────────────────────────────────────────
    story.append(Paragraph(f"Risk Events  ({len(events)} total)", h2_s))

    if not events:
        story.append(Paragraph("No risk events detected.", body_s))
    else:
        # Column widths: Source | Event title | Severity | Date
        cw = [22*mm, usable_w - 22*mm - 22*mm - 24*mm, 22*mm, 24*mm]
        hdr = [
            Paragraph("<b>Source</b>",   cell_s),
            Paragraph("<b>Event</b>",    cell_s),
            Paragraph("<b>Severity</b>", cell_s),
            Paragraph("<b>Detected</b>", cell_s),
        ]
        data = [hdr]
        for evt in events:
            data.append([
                Paragraph(evt.source, cell_s),
                Paragraph(evt.title,  cell_s),
                Paragraph(f"<b>{evt.severity}</b>", ParagraphStyle(
                    "sev", fontSize=8, textColor=sev_color(evt.severity), fontName="Helvetica-Bold"
                )),
                Paragraph(evt.detected_at.strftime('%d/%m/%Y') if evt.detected_at else "N/A", cell_s),
            ])

        tbl = Table(data, colWidths=cw, repeatRows=1)
        style_cmds = [
            ("BACKGROUND", (0,0), (-1,0), DARK),
            ("TEXTCOLOR",  (0,0), (-1,0), WHITE),
            ("FONTSIZE",   (0,0), (-1,-1), 8),
            ("GRID",       (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, LIGHT]),
            ("PADDING",    (0,0), (-1,-1), 5),
            ("VALIGN",     (0,0), (-1,-1), "TOP"),
        ]
        tbl.setStyle(TableStyle(style_cmds))
        story.append(tbl)

    # ── Footer ───────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT, spaceBefore=16, spaceAfter=6))
    story.append(Paragraph(
        "VenderScope  ·  Continuous Passive Vendor Risk Intelligence  ·  "
        "Data sources: HIBP, NVD (NIST), Companies House, Shodan  ·  "
        "This report should be reviewed by a qualified security professional.",
        footer_s
    ))

    doc.build(story)
    return buf.getvalue()