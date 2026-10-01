"""
Webhook do Melhor Envio
------------------------
POST /webhook/melhor-envio
POST /api/webhook/melhor-envio
POST /webhook/melhorenvio

Trata eventos de compra de etiqueta, geração de tracking e entrega do Melhor Envio.
Atualiza automaticamente o status no site para 'shipped' (Enviado) e 'delivered' (Entregue),
salva o código de rastreio e notifica o cliente por e-mail e WhatsApp.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Order
from app.services import melhorenvio_service as me_service
from app.core import emails
from app.services.whatsapp import notify_customer_order_shipped, notify_customer_order_delivered

logger = logging.getLogger(__name__)
router = APIRouter(tags=["webhook"])

# Mapeamento abrangente de eventos do Melhor Envio → status interno do pedido
EVENT_STATUS_MAP = {
    # Etiqueta Comprada / Liberada / Gerada / Postada / Em Trânsito
    "order.released": "shipped",
    "order.generated": "shipped",
    "order.posted": "shipped",
    "order.received": "shipped",
    "order.paid": "shipped",
    "shipment.released": "shipped",
    "shipment.posted": "shipped",
    "shipment.generated": "shipped",
    "shipment.received": "shipped",
    "shipment_released": "shipped",
    "shipment_posted": "shipped",
    "shipment_generated": "shipped",
    "shipment_received": "shipped",
    "released": "shipped",
    "posted": "shipped",
    "generated": "shipped",
    "paid": "shipped",
    "in_transit": "shipped",
    "attending": "shipped",
    
    # Etiqueta Entregue (Concluído)
    "order.delivered": "delivered",
    "shipment.delivered": "delivered",
    "shipment_delivered": "delivered",
    "delivered": "delivered",
    
    # Etiqueta Cancelada
    "order.cancelled": "cancelled",
    "order.canceled": "cancelled",
    "shipment.canceled": "cancelled",
    "shipment.cancelled": "cancelled",
    "shipment_canceled": "cancelled",
    "shipment_cancelled": "cancelled",
    "cancelled": "cancelled",
    "canceled": "cancelled",
}


@router.get("/webhook/melhor-envio")
@router.get("/api/webhook/melhor-envio")
@router.get("/webhook/melhorenvio")
@router.get("/shipping/webhook")
@router.get("/api/shipping/webhook")
async def webhook_melhor_envio_health():
    """Endpoint de handshake / verificação de saúde da URL do webhook."""
    return {"status": "online", "service": "Melhor Envio Webhook ECOSOPIS"}


@router.post("/webhook/melhor-envio", summary="Webhook de eventos do Melhor Envio")
@router.post("/api/webhook/melhor-envio", summary="Webhook de eventos do Melhor Envio (com prefixo /api)")
@router.post("/webhook/melhorenvio", summary="Webhook de eventos do Melhor Envio (alias sem traço)")
@router.post("/shipping/webhook", summary="Webhook de eventos do Melhor Envio (alias shipping)")
@router.post("/api/shipping/webhook", summary="Webhook de eventos do Melhor Envio (alias api shipping)")
async def webhook_melhor_envio(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Recebe notificações de status do Melhor Envio e atualiza o pedido correspondente.

    Eventos tratados:
    - order.released / generated / posted / received → shipped (Enviado) + Código de Rastreio para o cliente
    - order.delivered                              → delivered (Entregue) + Notificação ao cliente
    - order.cancelled                              → cancelled (Cancelado)
    """
    try:
        payload = await request.json()
    except Exception:
        try:
            form = await request.form()
            payload = dict(form)
        except Exception:
            payload = dict(request.query_params)

    logger.info(f"[WEBHOOK ME] Payload recebido: {payload}")

    event = (
        payload.get("event")
        or payload.get("type")
        or payload.get("status")
        or payload.get("action")
    )
    
    # Suporte a campos planos e aninhados no campo 'data'
    data = payload.get("data")
    if not isinstance(data, dict):
        data = {}
    
    shipment_id = (
        payload.get("shipment_id")
        or payload.get("order_id")
        or (data.get("id"))
        or (data.get("shipment_id"))
        or (data.get("order_id"))
        or str(payload.get("id", ""))
    )
    if shipment_id:
        shipment_id = str(shipment_id).strip()
    
    tracking_code = (
        payload.get("tracking")
        or payload.get("tracking_code")
        or payload.get("code")
        or (data.get("tracking"))
        or (data.get("tracking_code"))
        or (data.get("code"))
    )
    if tracking_code:
        tracking_code = str(tracking_code).strip()

    if not event and not shipment_id and not tracking_code:
        logger.warning("[WEBHOOK ME] Dados insuficientes no payload.")
        return {"received": True, "processado": False, "motivo": "payload sem identificador"}

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
            "shipment_id": shipment_id
        }

    # Se temos o pedido, executa a sincronização completa
    res_sync = me_service.sync_melhor_envio_status(order, db)

    # Se o evento do payload trouxer um status mapeado diretamente e ainda não foi aplicado:
    novo_status = EVENT_STATUS_MAP.get(str(event).lower()) if event else None
    if novo_status and order.status != novo_status:
        status_anterior = order.status
        order.status = novo_status
        if tracking_code and not order.codigo_rastreio:
            order.codigo_rastreio = tracking_code

        db.commit()
        db.refresh(order)
        logger.info(f"[WEBHOOK ME] Pedido #{order.id} status atualizado: {status_anterior} → {novo_status}")

        customer_email = getattr(order, "customer_email", None) or getattr(order, "buyer_email", None) or (order.user.email if order.user else None)

        if novo_status == "shipped":
            try:
                if customer_email:
                    emails.send_order_update_email(customer_email, order.id, "shipped", order.codigo_rastreio)
                notify_customer_order_shipped(order, db, order.codigo_rastreio)
            except Exception as e:
                logger.error(f"[WEBHOOK ME] Erro ao notificar cliente sobre envio: {e}")

        elif novo_status == "delivered":
            try:
                if customer_email:
                    emails.send_order_update_email(customer_email, order.id, "delivered")
                notify_customer_order_delivered(order, db)
            except Exception as e:
                logger.error(f"[WEBHOOK ME] Erro ao notificar cliente sobre entrega: {e}")

    return {
        "received": True,
        "processado": True,
        "pedido_id": order.id,
        "novo_status": order.status,
        "tracking_code": getattr(order, "codigo_rastreio", None),
        "shipment_id": getattr(order, "shipment_id", None),
        "sync_details": res_sync
    }

