from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.core.melhorenvio_service import MelhorEnvioService
import os
import logging
import io
from datetime import datetime
import requests
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class ShippingItem(BaseModel):
    id: Optional[str] = "1"
    width: float
    height: float
    length: float
    weight: float
    price: float
    quantity: int

class ShippingRequest(BaseModel):
    dest_cep: str
    items: List[ShippingItem]

@router.post("/calculate")
async def calculate_shipping(request: ShippingRequest):
    """
    Calcula opções de frete reais via Melhor Envio.
    """
    items_dict = [item.model_dump() for item in request.items]
    options, error = MelhorEnvioService.calculate_shipping(request.dest_cep, items_dict)
    if error and not options:
        raise HTTPException(status_code=422, detail=error)
    return options

@router.get("/test-connection")
async def test_melhorenvio():
    """
    Testa a conexão com o Melhor Envio e retorna detalhes do erro se houver.
    """
    url = f"{MelhorEnvioService.MELHORENVIO_URL}/api/v2/me"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {MelhorEnvioService.MELHORENVIO_TOKEN}"
    }
    me_status = "Unknown"
    me_error = None
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        me_status = f"Success ({resp.status_code})"
    except Exception as e:
        me_error = str(e)
    
    # Teste de conectividade geral
    google_status = "Unknown"
    try:
        g_resp = requests.get("https://www.google.com", timeout=10)
        google_status = f"Success ({g_resp.status_code})"
    except Exception as ge:
        google_status = f"Error: {ge}"

    # Testes adicionais de subdomínios
    subdomains = {}
    for sub in ["www", "sandbox"]:
        sub_url = f"https://{sub}.melhorenvio.com.br"
        try:
            s_resp = requests.get(sub_url, timeout=5)
            subdomains[sub] = f"Success ({s_resp.status_code})"
        except Exception as se:
            subdomains[sub] = f"Error: {str(se)[:100]}"

    return {
        "melhorenvio_api": {
            "url": url,
            "status": me_status,
            "error": me_error,
            "token_length": len(MelhorEnvioService.MELHORENVIO_TOKEN)
        },
        "subdomain_tests": subdomains,
        "general_connectivity": {
            "google_test": google_status
        },
        "env_info": {
            "MELHORENVIO_URL": os.getenv("MELHORENVIO_URL"),
            "STORE_CEP": MelhorEnvioService.STORE_CEP
        }
    }

# --- Correios Label Generation (Merged from previous implementation) ---

SERVICE_PAC   = "03298"  # PAC
SERVICE_SEDEX = "03220"  # SEDEX

def _get_correios_token() -> str:
    usuario = os.getenv("CORREIOS_USUARIO")
    senha   = os.getenv("CORREIOS_SENHA")
    if not usuario or not senha:
        raise HTTPException(status_code=503, detail="Credenciais dos Correios não configuradas.")
    api_url = os.getenv("CORREIOS_API_URL", "https://apihom.correios.com.br")
    resp = requests.post(f"{api_url}/token/v1/autenticacao", auth=(usuario, senha), headers={"Content-Type": "application/json"}, timeout=15)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Falha ao autenticar nos Correios: {resp.text}")
    return resp.json().get("token")

def _simulate_label_pdf(order: models.Order) -> bytes:
    try:
        from reportlab.lib.pagesizes import A6
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.graphics.barcode import code128, qr
        from reportlab.lib import colors
        from datetime import datetime

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A6,
            rightMargin=8 * mm,
            leftMargin=8 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
        )

        styles = getSampleStyleSheet()
        bold_style = ParagraphStyle("BoldStyle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10)
        normal_style = ParagraphStyle("NormalStyle", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=10)
        title_style = ParagraphStyle("TitleStyle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, alignment=1) # centered
        small_style = ParagraphStyle("SmallStyle", parent=styles["Normal"], fontName="Helvetica", fontSize=6, leading=8)

        story = []

        # Header Title
        story.append(Paragraph("<b>⛟ MELHOR ENVIO / CORREIOS</b>", title_style))
        story.append(Spacer(1, 4*mm))

        # Determine shipping type
        shipping_method = getattr(order, "shipping_method", "SEDEX").upper()
        if not shipping_method or "PAC" not in shipping_method and "SEDEX" not in shipping_method:
            shipping_method = "SEDEX"

        # Tracking code simulation
        tracking = f"BR{100000000 + order.id}BR"

        # Top Table: Tracking + Service
        barcode = code128.Code128(tracking, barHeight=15*mm, barWidth=1.2)
        top_data = [
            [barcode, Paragraph(f"<b>{shipping_method}</b>", ParagraphStyle("Svc", parent=title_style, fontSize=16))]
        ]
        top_table = Table(top_data, colWidths=[65*mm, 25*mm])
        top_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (0,0), 'LEFT'),
            ('ALIGN', (1,0), (1,0), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(top_table)
        story.append(Paragraph(f"<b>Rastreio:</b> {tracking}", small_style))
        story.append(Spacer(1, 3*mm))

        # Destinatario
        dest_name = getattr(order, "customer_name", None) or "Cliente"
        address = order.address or {}
        dest_rows = [
            Paragraph("<b>DESTINATÁRIO</b>", bold_style),
            Paragraph(dest_name, normal_style),
            Paragraph(f"{address.get('street', 'Rua não informada')}, {address.get('number', 'S/N')} {address.get('complement', '')}", normal_style),
            Paragraph(f"{address.get('neighborhood', 'Bairro')} - {address.get('city', 'Cidade')} / {address.get('state', 'UF')}", normal_style),
            Paragraph(f"<b>CEP: {address.get('zip', address.get('cep', '00000-000'))}</b>", bold_style),
        ]
        
        # Remetente
        remet_rows = [
            Paragraph("<b>REMETENTE</b>", bold_style),
            Paragraph(os.getenv("STORE_NAME", "ECOSOPIS COSMÉTICA NATURAL"), normal_style),
            Paragraph(os.getenv("STORE_LOGRADOURO", "Rua da Natureza, 100"), normal_style),
            Paragraph("São Paulo / SP", normal_style),
            Paragraph("<b>CEP: 01000-000</b>", bold_style),
        ]

        # Addresses Table
        address_table = Table([[
            Table([[r] for r in dest_rows], colWidths=[88*mm]),
        ], [
            Table([[r] for r in remet_rows], colWidths=[88*mm]),
        ]], colWidths=[90*mm])
        
        address_table.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 0.5, colors.black),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.black),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(address_table)
        story.append(Spacer(1, 4*mm))

        # Bottom Info
        story.append(Paragraph(f"Pedido: <b>#{order.id}</b> | Peso Estimado: 500g", small_style))
        story.append(Paragraph(f"Emitido em: {datetime.now().strftime('%d/%m/%Y %H:%M')}", small_style))
        story.append(Paragraph("Documento gerado eletronicamente.", small_style))

        doc.build(story)
        buf.seek(0)
        return buf.read()
    except Exception as e:
        print(f"Error generating professional label: {e}")
        content = f"ETIQUETA SIMULADA — Pedido #{order.id}\nDestinatario: {getattr(order,'customer_name','')}"
        return content.encode("utf-8")

@router.post("/generate-label/{order_id}")
async def generate_label(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Executa o fluxo completo Melhor Envio para o pedido:
    cart → checkout (compra) → generate → print → tracking
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    # Aceita pedidos pagos, já enviados (re-gera) ou com erro anterior
    allowed = {"paid", "shipped", "erro_envio", "ERRO_ENVIO", "processando_envio"}
    if order.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Pedido com status '{order.status}' não pode ter etiqueta gerada. Status esperado: pago (paid)."
        )

    # Se já tem etiqueta salva e pedido está enviado, apenas retorna
    if order.status == "shipped" and getattr(order, "etiqueta_url", None):
        return {
            "order_id": order_id,
            "label_url": order.etiqueta_url,
            "tracking_code": getattr(order, "codigo_rastreio", None),
            "shipment_id": getattr(order, "shipment_id", None),
            "status": order.status,
            "reused": True,
        }

    from app.models.pedido import Pedido
    from app.services import melhorenvio_service as me_service

    pedido = Pedido.from_order(order)
    resultado = me_service.processar_envio(pedido, db)

    if resultado.get("erro"):
        erro_str = resultado["erro"]

        # Garante que o status do pedido volta a 'paid' se falhou no envio
        # (processando_envio → paid) para permitir nova tentativa
        if order.status in ("processando_envio", "erro_envio", "PROCESSANDO_ENVIO", "ERRO_ENVIO"):
            order.status = "paid"
            db.commit()

        raise HTTPException(
            status_code=422,
            detail=f"Erro Melhor Envio: {erro_str}"
        )

    return {
        "order_id": order_id,
        "label_url": resultado.get("etiqueta_url"),
        "tracking_code": resultado.get("tracking_code"),
        "shipment_id": resultado.get("shipment_id"),
        "status": resultado.get("status"),
        "reused": False,
        "simulated": False,
    }

@router.get("/label/{order_id}")
async def download_label(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order or not getattr(order, "correios_label_url", None):
        raise HTTPException(status_code=404, detail="Etiqueta não encontrada.")
    label_path = order.correios_label_url.lstrip("/")
    if not os.path.exists(label_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    return FileResponse(label_path, media_type="application/pdf", filename=f"etiqueta-pedido-{order_id}.pdf")
