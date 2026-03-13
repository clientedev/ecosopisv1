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
    options = MelhorEnvioService.calculate_shipping(request.dest_cep, items_dict)
    if not options:
        return []
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
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        return {
            "status_code": resp.status_code,
            "response": resp.json() if resp.status_code == 200 else resp.text,
            "token_prefix": MelhorEnvioService.MELHORENVIO_TOKEN[:5] if MelhorEnvioService.MELHORENVIO_TOKEN else "None",
            "url_used": url,
            "url_length": len(MelhorEnvioService.MELHORENVIO_URL),
            "token_length": len(MelhorEnvioService.MELHORENVIO_TOKEN)
        }
    except Exception as e:
        return {"error": str(e)}

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
        dest_name = getattr(order, "customer_name", None) or "Cliente"
        c.drawString(20, h-100, f"DESTINATÁRIO: {dest_name}")
        c.drawString(20, h-120, f"Rua: {address.get('street', '-')}")
        c.drawString(20, h-140, f"Cidade: {address.get('city', '-')} - {address.get('state', '-')}")
        c.drawString(20, h-160, f"CEP: {address.get('zip', '-')}")
        c.drawString(20, h-200, "REMETENTE: ECOSOPIS")
        c.drawString(20, h-220, os.getenv("STORE_LOGRADOURO", "Rua da Natureza, 100"))
        c.save()
        buf.seek(0)
        return buf.read()
    except Exception:
        content = f"ETIQUETA — Pedido #{order.id}\nDestinatario: {getattr(order,'customer_name','')}"
        return content.encode()

@router.post("/generate-label/{order_id}")
async def generate_label(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    os.makedirs("static/labels", exist_ok=True)
    label_filename = f"etiqueta-pedido-{order_id}.pdf"
    label_path = f"static/labels/{label_filename}"

    # For now, always use simulation or implement full Correios logic if needed.
    # Standardizing on simulation if no credentials.
    pdf_bytes = _simulate_label_pdf(order)

    with open(label_path, "wb") as f:
        f.write(pdf_bytes)

    label_url = f"/static/labels/{label_filename}"
    order.correios_label_url = label_url
    if order.status == "paid":
        order.status = "shipped"
    db.commit()
    return {"order_id": order_id, "label_url": label_url, "status": order.status}

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
