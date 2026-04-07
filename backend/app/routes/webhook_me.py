"""
Webhook do Melhor Envio
------------------------
POST /webhook/melhor-envio

Trata eventos de tracking e atualiza automaticamente o status do pedido.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Order

logger = logging.getLogger(__name__)
router = APIRouter(tags=["webhook"])

# Mapeamento de eventos do Melhor Envio → status interno do pedido
EVENT_STATUS_MAP = {
    "shipment_posted": "ENVIADO",
    "shipment_delivered": "delivered",
    "shipment_canceled": "cancelled",
    "shipment_generated": "ENVIADO",
}


@router.post("/webhook/melhor-envio", summary="Webhook de eventos do Melhor Envio")
async def webhook_melhor_envio(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Recebe notificações de status do Melhor Envio e atualiza o pedido correspondente.

    Eventos tratados:
    - shipment_posted    → ENVIADO
    - shipment_delivered → delivered
    - shipment_canceled  → cancelled
    - shipment_generated → ENVIADO
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload inválido.")

    logger.info(f"[WEBHOOK ME] Payload recebido: {payload}")

    event = payload.get("event") or payload.get("type") or payload.get("status")
    shipment_id = (
        payload.get("shipment_id")
        or payload.get("order_id")
        or str(payload.get("id", ""))
    )
    tracking_code = payload.get("tracking") or payload.get("tracking_code")

    if not event:
        logger.warning("[WEBHOOK ME] Evento não identificado no payload.")
        return {"received": True, "processado": False, "motivo": "evento não identificado"}

    novo_status = EVENT_STATUS_MAP.get(event)
    if not novo_status:
        logger.info(f"[WEBHOOK ME] Evento '{event}' não mapeado, ignorando.")
        return {"received": True, "processado": False, "motivo": f"evento '{event}' não mapeado"}

    # Buscar pedido pelo shipment_id
    order = None
    if shipment_id:
        order = db.query(Order).filter(Order.shipment_id == shipment_id).first()

    # Fallback: busca pelo tracking_code
    if not order and tracking_code:
        order = db.query(Order).filter(Order.codigo_rastreio == tracking_code).first()

    if not order:
        logger.warning(
            f"[WEBHOOK ME] Pedido não encontrado para shipment_id={shipment_id}, tracking={tracking_code}"
        )
        return {
            "received": True,
            "processado": False,
            "motivo": "pedido não encontrado",
        }

    # Atualizar status e tracking se disponível
    order.status = novo_status
    if tracking_code:
        order.codigo_rastreio = tracking_code

    db.commit()
    logger.info(
        f"[WEBHOOK ME] Pedido {order.id} atualizado → status={novo_status} tracking={tracking_code}"
    )

    return {
        "received": True,
        "processado": True,
        "pedido_id": order.id,
        "novo_status": novo_status,
        "tracking_code": tracking_code,
    }
