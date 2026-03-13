<<<<<<< HEAD
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.core.melhorenvio_service import MelhorEnvioService

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
    # Converte Pydantic items para dicts
    items_dict = [item.model_dump() for item in request.items]
    
    options = MelhorEnvioService.calculate_shipping(request.dest_cep, items_dict)
    
    if not options:
        # Fallback ou erro se nada for retornado (ex: CEP inválido)
        return []
        
    return options
=======
"""
Shipping module — Correios Sigep Web label generation
"""
import os
import logging
import io
from datetime import datetime

import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Correios Sigep WSDL ──────────────────────────────────────────────────────
SIGEP_WSDL_HOM  = "https://apihom.correios.com.br/token/v1/autenticacao"
# We'll use the REST-based Token + Prepostagem API (new Correios API)
# instead of the legacy SOAP Sigep which requires a physical contract.
CORREIOS_API_URL = os.getenv("CORREIOS_API_URL", "https://apihom.correios.com.br")

SERVICE_PAC   = "03298"  # PAC
SERVICE_SEDEX = "03220"  # SEDEX


def _get_correios_token() -> str:
    """Gets an OAuth2 token from Correios API."""
    usuario = os.getenv("CORREIOS_USUARIO")
    senha   = os.getenv("CORREIOS_SENHA")

    if not usuario or not senha:
        raise HTTPException(
            status_code=503,
            detail="Credenciais dos Correios não configuradas (CORREIOS_USUARIO / CORREIOS_SENHA)."
        )

    api_url = os.getenv("CORREIOS_API_URL", "https://apihom.correios.com.br")
    resp = requests.post(
        f"{api_url}/token/v1/autenticacao",
        auth=(usuario, senha),
        headers={"Content-Type": "application/json"},
        timeout=15,
    )

    if resp.status_code != 200:
        logger.error(f"Correios auth error: {resp.status_code} {resp.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao autenticar nos Correios: {resp.text}"
        )

    return resp.json().get("token")


def _generate_label_pdf(order: models.Order, token: str) -> bytes:
    """Calls the Correios Prepostagem API to generate a shipping label (PDF)."""
    api_url  = os.getenv("CORREIOS_API_URL", "https://apihom.correios.com.br")
    contrato = os.getenv("CORREIOS_CONTRATO")
    cartao   = os.getenv("CORREIOS_CARTAO_POSTAGEM")

    address = order.address or {}
    shipping_method = getattr(order, "shipping_method", "pac") or "pac"
    service_code = SERVICE_SEDEX if shipping_method == "sedex" else SERVICE_PAC

    # Recipient from order address
    dest_cep     = (address.get("zip") or "").replace("-", "").replace(" ", "")
    dest_street  = address.get("street", "")
    dest_city    = address.get("city", "")
    dest_state   = address.get("state", "")
    dest_name    = getattr(order, "buyer_name", None) or "Cliente"

    # Sender from env
    rem_cep      = (os.getenv("STORE_CEP") or "").replace("-", "").replace(" ", "")
    rem_name     = os.getenv("STORE_NOME", "ECOSOPIS")
    rem_street   = os.getenv("STORE_LOGRADOURO", "")
    rem_number   = os.getenv("STORE_NUMERO", "S/N")
    rem_bairro   = os.getenv("STORE_BAIRRO", "")
    rem_city     = os.getenv("STORE_CIDADE", "")
    rem_state    = os.getenv("STORE_UF", "SP")

    total_weight = _estimate_weight_kg(order.items or [])

    payload = {
        "idCorreios": contrato,
        "cartaoPostagem": {"numero": cartao},
        "codigoServico": service_code,
        "remetente": {
            "nome": rem_name,
            "cep": rem_cep,
            "logradouro": rem_street,
            "numero": rem_number,
            "bairro": rem_bairro,
            "cidade": rem_city,
            "uf": rem_state,
        },
        "destinatario": {
            "nome": dest_name,
            "cep": dest_cep,
            "logradouro": dest_street,
            "bairro": address.get("neighborhood", ""),
            "cidade": dest_city,
            "uf": dest_state,
        },
        "objetoPostal": {
            "peso": total_weight,
            "altura": 10,
            "largura": 15,
            "comprimento": 20,
        },
        "referencia": f"PEDIDO-{order.id}",
        "dataPostagem": datetime.now().strftime("%Y-%m-%d"),
    }

    resp = requests.post(
        f"{api_url}/prepostagem/v1/objetos",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )

    if resp.status_code not in (200, 201):
        logger.error(f"Correios prepostagem error: {resp.status_code} {resp.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao gerar pré-postagem: {resp.text}"
        )

    data = resp.json()
    object_id = data.get("codigoObjeto") or data.get("id")
    if not object_id:
        raise HTTPException(status_code=502, detail="Correios não retornou código do objeto")

    # Now get the PDF label
    pdf_resp = requests.get(
        f"{api_url}/prepostagem/v1/objetos/{object_id}/etiqueta",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/pdf",
        },
        timeout=30,
    )

    if pdf_resp.status_code != 200:
        logger.error(f"Correios label PDF error: {pdf_resp.status_code}")
        raise HTTPException(status_code=502, detail="Falha ao baixar etiqueta PDF dos Correios")

    return pdf_resp.content


def _simulate_label_pdf(order: models.Order) -> bytes:
    """Creates a simple placeholder PDF for when Correios credentials are missing."""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A6
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A6)
        w, h = A6
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(w/2, h-30, "ECOSOPIS COSMÉTICA NATURAL")
        c.setFont("Helvetica", 10)
        c.drawCentredString(w/2, h-60, f"PEDIDO #{order.id}")
        address = order.address or {}
        dest_name = getattr(order, "buyer_name", None) or "Cliente"
        c.drawString(20, h-100, f"DESTINATÁRIO: {dest_name}")
        c.drawString(20, h-120, f"Rua: {address.get('street', '-')}")
        c.drawString(20, h-140, f"Cidade: {address.get('city', '-')} - {address.get('state', '-')}")
        c.drawString(20, h-160, f"CEP: {address.get('zip', '-')}")
        c.drawString(20, h-200, "REMETENTE: ECOSOPIS")
        c.drawString(20, h-220, os.getenv("STORE_LOGRADOURO", "Rua da Natureza, 100"))
        c.save()
        buf.seek(0)
        return buf.read()
    except ImportError:
        # reportlab not available — create minimal valid PDF bytes
        content = f"ETIQUETA — Pedido #{order.id}\nDestinatario: {getattr(order,'buyer_name','')}\nCEP: {(order.address or {}).get('zip','')}"
        return content.encode()


def _estimate_weight_kg(items: list) -> float:
    """Rough weight estimate: 0.3 kg per item."""
    total_qty = sum(i.get("quantity", 1) for i in items)
    return max(0.1, round(total_qty * 0.3, 2))


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/generate-label/{order_id}")
async def generate_label(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generates a Correios shipping label PDF for a paid order.
    Saves the PDF in static/labels/ and returns download URL.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    if order.status not in ("paid", "shipped"):
        raise HTTPException(
            status_code=400,
            detail=f"Pedido com status '{order.status}' não pode ter etiqueta gerada. Somente pedidos pagos."
        )

    # Ensure labels directory exists
    os.makedirs("static/labels", exist_ok=True)
    label_filename = f"etiqueta-pedido-{order_id}.pdf"
    label_path     = f"static/labels/{label_filename}"

    correios_usuario = os.getenv("CORREIOS_USUARIO")

    if correios_usuario:
        # Real Correios API
        token = _get_correios_token()
        pdf_bytes = _generate_label_pdf(order, token)
    else:
        # Demo/simulation label (no credentials configured yet)
        logger.warning("Correios credentials not configured — generating simulated label")
        pdf_bytes = _simulate_label_pdf(order)

    with open(label_path, "wb") as f:
        f.write(pdf_bytes)

    label_url = f"/static/labels/{label_filename}"

    # Update order with label URL and mark as shipped
    order.correios_label_url = label_url
    if order.status == "paid":
        order.status = "shipped"
    db.commit()

    logger.info(f"Label generated for order {order_id}: {label_url}")

    return {
        "order_id": order_id,
        "label_url": label_url,
        "status": order.status,
        "message": "Etiqueta gerada com sucesso"
    }


@router.get("/label/{order_id}")
async def download_label(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns the label PDF file for download."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order or not getattr(order, "correios_label_url", None):
        raise HTTPException(status_code=404, detail="Etiqueta não encontrada. Gere a etiqueta primeiro.")

    label_path = order.correios_label_url.lstrip("/")
    if not os.path.exists(label_path):
        raise HTTPException(status_code=404, detail="Arquivo de etiqueta não encontrado no servidor")

    return FileResponse(
        label_path,
        media_type="application/pdf",
        filename=f"etiqueta-pedido-{order_id}.pdf",
    )
>>>>>>> 647e807ad5b6cf780b235da1fc4d9e9a55405983
