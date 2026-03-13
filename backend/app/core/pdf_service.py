import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import A5, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

STORE_NAME = os.getenv("STORE_NAME", "ECOSOPIS Cosméticos Naturais")
STORE_ADDRESS = os.getenv("STORE_ADDRESS", "Endereço da Loja")
STORE_PHONE = os.getenv("STORE_PHONE", "(00) 00000-0000")
STORE_EMAIL = os.getenv("STORE_EMAIL", "contato@ecosopis.com.br")


def generate_shipping_label_pdf(order: dict) -> bytes:
    """Generate a shipping label PDF for the given order. Returns PDF as bytes."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A5,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )

    styles = getSampleStyleSheet()

    brand_style = ParagraphStyle("Brand", parent=styles["Normal"], fontSize=15,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#2d5a27"), alignment=TA_CENTER, spaceAfter=2)
    section_title_style = ParagraphStyle("SectionTitle", parent=styles["Normal"], fontSize=7,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#666666"), alignment=TA_LEFT, spaceAfter=1, spaceBefore=4)
    main_text_style = ParagraphStyle("MainText", parent=styles["Normal"], fontSize=10,
        fontName="Helvetica-Bold", textColor=colors.black, alignment=TA_LEFT, spaceAfter=2)
    sub_text_style = ParagraphStyle("SubText", parent=styles["Normal"], fontSize=8.5,
        fontName="Helvetica", textColor=colors.HexColor("#333333"), alignment=TA_LEFT, spaceAfter=1)
    order_id_style = ParagraphStyle("OrderId", parent=styles["Normal"], fontSize=13,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#2d5a27"), alignment=TA_RIGHT)
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=7,
        fontName="Helvetica", textColor=colors.HexColor("#888888"), alignment=TA_CENTER)

    address = order.get("address", {})
    customer_name = order.get("customer_name", "Cliente")
    items = order.get("items", [])
    order_id = order.get("id", "")
    total = order.get("total", 0)
    created_at = order.get("created_at", datetime.now())

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at = datetime.now()
    date_str = created_at.strftime("%d/%m/%Y %H:%M")

    story = []

    # Header
    header_data = [[
        Paragraph(f"📦 {STORE_NAME}", brand_style),
        Paragraph(f"Pedido #{order_id}", order_id_style)
    ]]
    header_table = Table(header_data, colWidths=[100 * mm, 50 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#2d5a27"), spaceAfter=4))

    # Recipient and Sender columns
    recipient_block = [
        Paragraph("DESTINATÁRIO", section_title_style),
        Paragraph(customer_name.upper(), main_text_style),
        Paragraph(address.get("street", "—"), sub_text_style),
        Paragraph(f"Bairro: {address.get('neighborhood', '')}  —  CEP: {address.get('zip', '')}", sub_text_style),
        Paragraph(f"{address.get('city', '')} - {address.get('state', '')}", sub_text_style),
    ]
    sender_block = [
        Paragraph("REMETENTE", section_title_style),
        Paragraph(STORE_NAME.upper(), main_text_style),
        Paragraph(STORE_ADDRESS, sub_text_style),
        Paragraph(f"Tel: {STORE_PHONE}", sub_text_style),
        Paragraph(STORE_EMAIL, sub_text_style),
    ]

    two_col = Table([[recipient_block, sender_block]], colWidths=[82 * mm, 68 * mm])
    two_col.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 6),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, colors.HexColor("#cccccc")),
        ("LEFTPADDING", (1, 0), (1, -1), 6),
        ("RIGHTPADDING", (1, 0), (-1, -1), 0),
    ]))
    story.append(two_col)
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceBefore=4, spaceAfter=4))

    # Items
    story.append(Paragraph("ITENS DO PEDIDO", section_title_style))
    items_text = "  •  ".join([
        f"{i.get('quantity', 1)}x {i.get('product_name', 'Produto')}" for i in items
    ])
    story.append(Paragraph(items_text, sub_text_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceBefore=4, spaceAfter=4))

    # Footer
    footer_data = [[
        Paragraph(f"Emitida em: {date_str}", small_style),
        Paragraph(f"Total: R$ {float(total):.2f}", ParagraphStyle("TotalStyle", parent=small_style,
            textColor=colors.HexColor("#2d5a27"), fontName="Helvetica-Bold", alignment=TA_CENTER)),
        Paragraph("www.ecosopis.com.br", small_style),
    ]]
    footer_table = Table(footer_data, colWidths=[50 * mm, 50 * mm, 50 * mm])
    footer_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(footer_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
