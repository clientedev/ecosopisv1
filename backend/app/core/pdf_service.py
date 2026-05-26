import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
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
STORE_ADDRESS = os.getenv("STORE_ADDRESS", "Rua da Natureza, 100 - São Paulo/SP")
STORE_PHONE = os.getenv("STORE_PHONE", "(11) 99999-9999")
STORE_EMAIL = os.getenv("STORE_EMAIL", "contato@ecosopis.com.br")


def generate_shipping_label_pdf(order: dict) -> bytes:
    """Generate a premium A4 invoice/receipt PDF for the given order. Returns PDF as bytes."""
    buffer = io.BytesIO()

    # Setup document on A4 with 15mm margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()

    # Typography & Styles
    title_style = ParagraphStyle(
        "BrandTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=colors.HexColor("#2d5a27"),
        alignment=TA_LEFT,
        spaceAfter=2
    )
    tagline_style = ParagraphStyle(
        "BrandTagline",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        textColor=colors.HexColor("#4a7c59"),
        alignment=TA_LEFT,
        spaceAfter=10
    )
    doc_title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=colors.HexColor("#1f2937"),
        alignment=TA_RIGHT,
        spaceAfter=4
    )
    order_id_style = ParagraphStyle(
        "OrderId",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=colors.HexColor("#2d5a27"),
        alignment=TA_RIGHT,
        spaceAfter=2
    )
    date_style = ParagraphStyle(
        "OrderDate",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        textColor=colors.HexColor("#4b5563"),
        alignment=TA_RIGHT
    )
    
    info_body_style = ParagraphStyle(
        "InfoBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=colors.HexColor("#1f2937"),
        leading=14
    )
    
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=colors.white,
        alignment=TA_LEFT
    )
    table_header_center_style = ParagraphStyle(
        "TableHeaderCenter",
        parent=table_header_style,
        alignment=TA_CENTER
    )
    table_header_right_style = ParagraphStyle(
        "TableHeaderRight",
        parent=table_header_style,
        alignment=TA_RIGHT
    )
    
    table_body_style = ParagraphStyle(
        "TableBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=colors.HexColor("#1f2937"),
        alignment=TA_LEFT
    )
    table_body_center_style = ParagraphStyle(
        "TableBodyCenter",
        parent=table_body_style,
        alignment=TA_CENTER
    )
    table_body_right_style = ParagraphStyle(
        "TableBodyRight",
        parent=table_body_style,
        alignment=TA_RIGHT
    )
    
    summary_label_style = ParagraphStyle(
        "SummaryLabel",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=colors.HexColor("#4b5563"),
        alignment=TA_RIGHT
    )
    summary_value_style = ParagraphStyle(
        "SummaryValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=colors.HexColor("#1f2937"),
        alignment=TA_RIGHT
    )
    summary_discount_style = ParagraphStyle(
        "SummaryDiscount",
        parent=summary_value_style,
        textColor=colors.HexColor("#059669")
    )
    summary_label_total_style = ParagraphStyle(
        "SummaryLabelTotal",
        parent=summary_label_style,
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=colors.HexColor("#1f2937")
    )
    summary_value_total_style = ParagraphStyle(
        "SummaryValueTotal",
        parent=summary_value_style,
        fontSize=13,
        textColor=colors.HexColor("#2d5a27")
    )
    
    footer_thanks_style = ParagraphStyle(
        "FooterThanks",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9.5,
        textColor=colors.HexColor("#2d5a27"),
        alignment=TA_CENTER,
        spaceAfter=4
    )
    footer_info_style = ParagraphStyle(
        "FooterInfo",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        textColor=colors.HexColor("#9ca3af"),
        alignment=TA_CENTER
    )

    # Order data extraction
    address = order.get("address", {})
    customer_name = order.get("customer_name") or order.get("buyer_name") or "Cliente"
    customer_email = order.get("customer_email") or order.get("buyer_email") or "—"
    customer_phone = order.get("customer_phone") or "—"
    customer_cpf = order.get("customer_cpf") or "—"
    items = order.get("items", [])
    order_id = order.get("id", "")
    total = order.get("total", 0)
    shipping_price = order.get("shipping_price", 0)
    shipping_method = order.get("shipping_method") or ""
    discount_amount = order.get("discount_amount", 0)
    coupon_code = order.get("coupon_code") or ""
    created_at = order.get("created_at", datetime.now())
    cep = address.get("zip") or address.get("postal_code") or address.get("cep") or "—"

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at = datetime.now()
    date_str = created_at.strftime("%d/%m/%Y %H:%M")

    story = []

    # 1. Header (Brand details on left, Order info on right)
    header_left = [
        Paragraph(STORE_NAME, title_style),
        Paragraph("Beleza Consciente | Saboaria & Cosmetica Natural", tagline_style)
    ]
    header_right = [
        Paragraph("COMPROVANTE DE PEDIDO", doc_title_style),
        Paragraph(f"Pedido: <b>#{order_id}</b>", order_id_style),
        Paragraph(f"Data: {date_str}", date_style)
    ]
    
    header_table = Table([[header_left, header_right]], colWidths=[110 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2d5a27"), spaceBefore=2, spaceAfter=8))

    # 2. Customer & Shipping Info Side-by-Side Table
    customer_html = (
        "<b>DADOS DO CLIENTE</b><br/><br/>"
        f"<b>Nome:</b> {customer_name}<br/>"
        f"<b>E-mail:</b> {customer_email}<br/>"
        f"<b>WhatsApp:</b> {customer_phone}<br/>"
        f"<b>CPF:</b> {customer_cpf}"
    )
    delivery_html = (
        "<b>ENDERECO DE ENTREGA</b><br/><br/>"
        f"<b>Logradouro:</b> {address.get('street', '-')}, {address.get('number', '-')}<br/>"
        f"<b>Complemento:</b> {address.get('complement') or '-'}<br/>"
        f"<b>Bairro:</b> {address.get('neighborhood', '-')}<br/>"
        f"<b>Cidade/UF:</b> {address.get('city', '-')} - {address.get('state', '-')}<br/>"
        f"<b>CEP:</b> {cep}"
    )

    info_data = [[
        Paragraph(customer_html, info_body_style),
        Paragraph(delivery_html, info_body_style)
    ]]
    info_table = Table(info_data, colWidths=[90 * mm, 90 * mm])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 15))

    # 3. Items Table
    table_data = [[
        Paragraph("<b>PRODUTO</b>", table_header_style),
        Paragraph("<b>QTD</b>", table_header_center_style),
        Paragraph("<b>PREÇO UNIT.</b>", table_header_right_style),
        Paragraph("<b>TOTAL</b>", table_header_right_style)
    ]]

    for item in items:
        p_name = item.get("product_name", "Produto")
        qty = item.get("quantity", 1)
        price = float(item.get("price", 0))
        total_item = price * qty
        
        table_data.append([
            Paragraph(p_name, table_body_style),
            Paragraph(str(qty), table_body_center_style),
            Paragraph(f"R$ {price:.2f}".replace(".", ","), table_body_right_style),
            Paragraph(f"R$ {total_item:.2f}".replace(".", ","), table_body_right_style)
        ])

    items_table = Table(table_data, colWidths=[105 * mm, 15 * mm, 30 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d5a27")),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 12))

    # 4. Financial Summary Right Aligned
    subtotal = float(total) - float(shipping_price) + float(discount_amount)
    
    summary_data = [
        [Paragraph("Subtotal:", summary_label_style), Paragraph(f"R$ {subtotal:.2f}".replace(".", ","), summary_value_style)],
        [Paragraph(f"Frete ({shipping_method or 'Fixo'}):", summary_label_style), Paragraph(f"R$ {shipping_price:.2f}".replace(".", ","), summary_value_style)]
    ]
    
    if float(discount_amount) > 0:
        disc_label = f"Desconto ({coupon_code}):" if coupon_code else "Desconto:"
        summary_data.append([
            Paragraph(disc_label, summary_label_style),
            Paragraph(f"- R$ {discount_amount:.2f}".replace(".", ","), summary_discount_style)
        ])
        
    summary_data.append([
        Paragraph("Total do Pedido:", summary_label_total_style),
        Paragraph(f"R$ {float(total):.2f}".replace(".", ","), summary_value_total_style)
    ])
    
    pay_method = order.get("payment_method") or "Stripe"
    if pay_method.lower() == "mercadopago":
        pay_label = "Mercado Pago"
    elif pay_method.lower() == "stripe":
        pay_label = "Stripe"
    else:
        pay_label = pay_method.title()
        
    summary_data.append([
        Paragraph("Forma de Pagamento:", summary_label_style),
        Paragraph(pay_label, summary_value_style)
    ])
    
    summary_table = Table(summary_data, colWidths=[45 * mm, 35 * mm])
    summary_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    
    container_table = Table([[Spacer(1, 1), summary_table]], colWidths=[100 * mm, 80 * mm])
    container_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(container_table)
    story.append(Spacer(1, 30))

    # 5. Footer (divider + thank you only, no contact info)
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=10, spaceAfter=10))
    story.append(Paragraph("Obrigado por apoiar a beleza consciente e natural!", footer_thanks_style))

    # Build document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

