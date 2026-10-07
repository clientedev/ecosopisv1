from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.core.melhorenvio_service import MelhorEnvioService
import os
import time
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
    name: Optional[str] = None
    width: float
    height: float
    length: float
    weight: float
    price: float
    quantity: int

class ShippingRequest(BaseModel):
    dest_cep: str
    items: List[ShippingItem]

class GenerateLabelPayload(BaseModel):
    package_width: Optional[float] = None
    package_height: Optional[float] = None
    package_length: Optional[float] = None
    package_weight: Optional[float] = None
    shipping_service_id: Optional[int] = None
    shipping_method: Optional[str] = None
    force_recreate: Optional[bool] = False

class QuoteOrderPayload(BaseModel):
    package_width: Optional[float] = None
    package_height: Optional[float] = None
    package_length: Optional[float] = None
    package_weight: Optional[float] = None

@router.post("/calculate")
async def calculate_shipping(request: ShippingRequest, db: Session = Depends(get_db)):
    """
    Calcula opções de frete reais via Melhor Envio utilizando as regras exatas de produtos:
    - Sabonete líquido: 300g
    - Sabonete em barra / comum: 100g
    - Demais produtos: 100g
    """
    items_dict = []
    for item in request.items:
        i_dict = item.model_dump()
        if not i_dict.get("name") and i_dict.get("id"):
            try:
                prod = db.query(models.Product).filter(models.Product.id == int(i_dict["id"])).first()
                if prod:
                    i_dict["name"] = prod.name
            except Exception:
                pass
        items_dict.append(i_dict)

    options, error = MelhorEnvioService.calculate_shipping(request.dest_cep, items_dict)
    if error and not options:
        if error == "CONEXAO_INDISPONIVEL":
            raise HTTPException(
                status_code=503,
                detail="O serviço de frete está temporariamente indisponível. Os valores de frete serão calculados normalmente no site de produção."
            )
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
            Paragraph(f"<b>CEP: {address.get('zip', address.get('postal_code', address.get('cep', '00000-000')))}</b>", bold_style),
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
    payload: Optional[GenerateLabelPayload] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Controla a geração da etiqueta:
    1. Se o envio não foi criado no cart, cria (com dimensões/peso/transportadora customizadas).
    2. Se já foi criado, verifica se o pagamento foi feito no Melhor Envio.
    3. Se pago, gera o PDF e atualiza status para 'shipped'.
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
            detail=f"Pedido com status '{order.status}' não pode ter etiqueta gerada."
        )

    # Se foram passados parâmetros de dimensões / transportadora, atualiza no pedido
    has_package_override = False
    if payload:
        if payload.package_width is not None and float(payload.package_width) > 0:
            order.package_width = float(payload.package_width)
            has_package_override = True
        if payload.package_height is not None and float(payload.package_height) > 0:
            order.package_height = float(payload.package_height)
            has_package_override = True
        if payload.package_length is not None and float(payload.package_length) > 0:
            order.package_length = float(payload.package_length)
            has_package_override = True
        if payload.package_weight is not None and float(payload.package_weight) > 0:
            order.package_weight = float(payload.package_weight)
            has_package_override = True
        if payload.shipping_service_id is not None:
            order.shipping_service_id = int(payload.shipping_service_id)
            has_package_override = True
        if payload.shipping_method:
            order.shipping_method = payload.shipping_method

        # Se forçar recriação ou alterar pacote/transportadora para pedido ainda não entregue
        if (payload.force_recreate or has_package_override) and order.status != "delivered":
            order.shipment_id = None
            order.etiqueta_url = None
            order.correios_label_url = None
            order.codigo_rastreio = None

        db.commit()
        db.refresh(order)

    # Se já tem etiqueta salva e o pedido está enviado/entregue (sem forçar recriação), retorna existente
    if order.status in ("shipped", "delivered") and getattr(order, "etiqueta_url", None) and not (payload and payload.force_recreate):
        return {
            "order_id": order_id,
            "label_url": order.etiqueta_url,
            "tracking_code": getattr(order, "codigo_rastreio", None),
            "shipment_id": getattr(order, "shipment_id", None),
            "status": order.status,
            "reused": True,
            "simulated": False,
        }

    from app.models.pedido import Pedido
    from app.services import melhorenvio_service as me_service

    pedido = Pedido.from_order(order)
    
    # 1. Se ainda não possui envio criado no Melhor Envio, envia apenas para o carrinho
    if not order.shipment_id:
        package_dims = {
            "width": getattr(order, "package_width", None) or 16.0,
            "height": getattr(order, "package_height", None) or 12.0,
            "length": getattr(order, "package_length", None) or 20.0,
            "weight": getattr(order, "package_weight", None) or 0.3,
        }
        resultado = me_service.processar_envio(
            pedido,
            db,
            service_id_override=getattr(order, "shipping_service_id", None),
            package_dimensions=package_dims,
            force_create=True
        )
        if resultado.get("erro"):
            raise HTTPException(
                status_code=422,
                detail=f"Erro ao criar envio no carrinho do Melhor Envio: {resultado['erro']}"
            )
        
        shipment_id = resultado.get("shipment_id")
        order.shipment_id = shipment_id
        db.commit()
        db.refresh(order)
        logger.info(f"[ME] Envio adicionado ao carrinho do Melhor Envio para o pedido #{order.id} (shipment_id={shipment_id}). Nenhuma compra automática foi realizada.")

        return {
            "order_id": order_id,
            "shipment_id": shipment_id,
            "status": order.status,
            "in_cart": True,
            "label_url": None,
            "tracking_code": getattr(order, "codigo_rastreio", None),
            "reused": False,
            "simulated": False,
            "message": f"Etiqueta adicionada ao carrinho do Melhor Envio (ID: {shipment_id})! Você decide quando efetuar a compra diretamente no painel do Melhor Envio."
        }

    # 2. Verificar se a etiqueta já foi paga/comprada pelo lojista no Melhor Envio
    shipment_details = me_service.obter_detalhes_envio(order.shipment_id)
    if not shipment_details:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível consultar os detalhes do envio no Melhor Envio. Verifique sua conexão ou se o token está ativo."
        )

    me_status = str(shipment_details.get("status", "")).lower()
    
    # Status que indicam que a etiqueta foi paga/comprada:
    # "released", "generated", "posted", "delivered", "received", "attending"
    paid_statuses = {"released", "generated", "posted", "delivered", "received", "attending"}
    
    if me_status not in paid_statuses:
        return {
            "order_id": order_id,
            "shipment_id": order.shipment_id,
            "status": order.status,
            "in_cart": True,
            "label_url": None,
            "tracking_code": getattr(order, "codigo_rastreio", None),
            "reused": False,
            "simulated": False,
            "message": f"A etiqueta já está no seu carrinho do Melhor Envio (ID: {order.shipment_id}, status: '{me_status}'). "
                       f"Efetue a compra no painel do Melhor Envio quando desejar e depois clique aqui novamente para gerar e imprimir o PDF."
        }

    # 3. Gerar, imprimir e obter tracking (a etiqueta já foi paga no Melhor Envio)
    try:
        me_service.gerar_etiqueta(order.shipment_id)
        etiqueta_url = me_service.imprimir_etiqueta(order.shipment_id)
        tracking_code = me_service.obter_tracking(order.shipment_id) or shipment_details.get("tracking") or ""
        
        order.etiqueta_url = etiqueta_url
        order.correios_label_url = etiqueta_url
        if tracking_code:
            order.codigo_rastreio = tracking_code
            
        # Determinar status correspondente
        if me_status == "delivered":
            order.status = "delivered"
        else:
            order.status = "shipped"
            
        db.commit()
        db.refresh(order)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar/imprimir etiqueta paga do Melhor Envio: {str(e)}"
        )

    return {
        "order_id": order_id,
        "label_url": order.etiqueta_url,
        "tracking_code": order.codigo_rastreio,
        "shipment_id": order.shipment_id,
        "status": order.status,
        "in_cart": False,
        "reused": False,
        "simulated": False,
        "message": "Etiqueta gerada e pronta para impressão!"
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


@router.post("/sync/{order_id}", summary="Sincronizar status e rastreio de um pedido com o Melhor Envio")
async def sync_shipping_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Consulta a API do Melhor Envio para o pedido especificado e atualiza status, rastreio e etiqueta.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    from app.services.melhorenvio_service import sync_melhor_envio_status
    result = sync_melhor_envio_status(order, db)
    return result


@router.post("/sync-all", summary="Sincronizar todos os pedidos ativos com o Melhor Envio")
async def sync_all_active_shipping(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Sincroniza todos os pedidos com status 'paid', 'processando_envio' ou 'shipped' que possuem shipment_id.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    from app.services.melhorenvio_service import sync_melhor_envio_status
    orders = db.query(models.Order).filter(
        models.Order.status.in_(["paid", "processando_envio", "shipped", "erro_envio"]),
        models.Order.shipment_id.isnot(None)
    ).all()

    results = []
    for o in orders:
        try:
            res = sync_melhor_envio_status(o, db)
            results.append(res)
        except Exception as e:
            logger.error(f"Erro ao sincronizar pedido #{o.id}: {e}")
            results.append({"pedido_id": o.id, "erro": str(e)})

    return {"total": len(orders), "synced": len(results), "details": results}


@router.post("/quote-order/{order_id}", summary="Cotar opções de frete disponíveis para o CEP do pedido")
async def quote_order_shipping(
    order_id: int,
    payload: Optional[QuoteOrderPayload] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Calcula as opções reais de transportadoras para o CEP do pedido
    utilizando as dimensões e peso informados pelo administrador.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    from app.models.pedido import Pedido
    from app.services.melhorenvio_service import _request_with_retry, CEP_ORIGEM
    pedido = Pedido.from_order(order)
    dest_cep = pedido.cep_cliente

    width = (payload.package_width if payload and payload.package_width else getattr(order, "package_width", None)) or 16.0
    height = (payload.package_height if payload and payload.package_height else getattr(order, "package_height", None)) or 12.0
    length = (payload.package_length if payload and payload.package_length else getattr(order, "package_length", None)) or 20.0
    
    # Se package_weight não foi informado ou é o default 0.3 sem personalização, usa o peso estimado aproximado
    if payload and payload.package_weight and float(payload.package_weight) > 0:
        weight = float(payload.package_weight)
    elif getattr(order, "package_weight", None) and float(order.package_weight) > 0 and float(order.package_weight) != 0.3:
        weight = float(order.package_weight)
    else:
        weight = pedido.estimated_weight

    insurance_val = max(float(pedido.valor or order.total or 10.0), 0.01)

    quote_payload = {
        "from": {"postal_code": CEP_ORIGEM},
        "to": {"postal_code": dest_cep},
        "package": {
            "height": round(float(height), 1),
            "width": round(float(width), 1),
            "length": round(float(length), 1),
            "weight": round(float(weight), 3),
        },
        "options": {
            "insurance_value": insurance_val,
            "receipt": False,
            "own_hand": False,
        }
    }

    try:
        resp = _request_with_retry("POST", "/api/v2/me/shipment/calculate", json=quote_payload)
        if resp.status_code == 200:
            raw_options = resp.json()
            options = []
            for opt in raw_options:
                if not opt.get("error") and (opt.get("price") or opt.get("custom_price")):
                    price_val = float(opt.get("custom_price") or opt.get("price") or 0)
                    options.append({
                        "id": opt.get("id"),
                        "name": opt.get("name"),
                        "company": (opt.get("company") or {}).get("name", ""),
                        "price": price_val,
                        "delivery_time": opt.get("custom_delivery_time") or opt.get("delivery_time"),
                        "currency": opt.get("currency", "R$"),
                    })
            error = None
        else:
            options = []
            error = f"Erro Melhor Envio ({resp.status_code}): {resp.text[:200]}"
    except Exception as exc:
        options = []
        error = str(exc)

    return {
        "dest_cep": dest_cep,
        "width": width,
        "height": height,
        "length": length,
        "weight": weight,
        "options": options,
        "error": error
    }


