"""
Payment module — Mercado Pago Checkout Pro integration
"""
import os
import logging
from typing import Any, Dict, List, Optional

import mercadopago
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── SDK init ────────────────────────────────────────────────────────────────
def get_mp_sdk() -> mercadopago.SDK:
    token = os.getenv("MP_ACCESS_TOKEN")
    if not token:
        raise HTTPException(
            status_code=500,
            detail="MP_ACCESS_TOKEN não configurado nas variáveis de ambiente"
        )
    return mercadopago.SDK(token)


# ── Pydantic schemas ─────────────────────────────────────────────────────────
class PreferenceItemIn(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float


class CreatePreferenceIn(BaseModel):
    order_id: Optional[int] = None          # pedido já criado
    items: List[PreferenceItemIn]
    total: float
    address: Optional[Dict[str, Any]] = None
    shipping_method: Optional[str] = "pac"
    shipping_price: Optional[float] = 0.0
    coupon_code: Optional[str] = None


class PreferenceResponse(BaseModel):
    preference_id: str
    init_point: str          # URL de checkout do MP (redirecionar usuário)
    sandbox_init_point: str  # URL do sandbox para testes
    order_id: int


# ── Helper ───────────────────────────────────────────────────────────────────
def _build_preference_body(data: CreatePreferenceIn, order_id: int) -> Dict[str, Any]:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    backend_url  = os.getenv("BACKEND_URL",  "http://localhost:8000").rstrip("/")

    # Mercado Pago requires absolute URLs with protocols
    if not frontend_url.startswith("http"):
        frontend_url = f"https://{frontend_url}"
    if not backend_url.startswith("http"):
        backend_url = f"https://{backend_url}"

    items = [
        {
            "id": str(item.product_id),
            "title": item.product_name,
            "quantity": item.quantity,
            "unit_price": round(float(item.price), 2),
            "currency_id": "BRL",
        }
        for item in data.items
    ]

    # Add shipping as a separate item if applicable
    if data.shipping_price and data.shipping_price > 0:
        shipping_name = "SEDEX" if data.shipping_method == "sedex" else "PAC"
        items.append({
            "id": "shipping",
            "title": f"Frete ({shipping_name})",
            "quantity": 1,
            "unit_price": round(float(data.shipping_price), 2),
            "currency_id": "BRL",
        })

    return {
        "items": items,
        "back_urls": {
            "success": f"{frontend_url}/pagamento?status=approved&order_id={order_id}",
            "failure": f"{frontend_url}/pagamento?status=failure&order_id={order_id}",
            "pending": f"{frontend_url}/pagamento?status=pending&order_id={order_id}",
        },
        "auto_return": "approved",
        "notification_url": f"{backend_url}/payment/webhook",
        "external_reference": str(order_id),
        "statement_descriptor": "ECOSOPIS",
        "payment_methods": {
            "excluded_payment_types": [],
            "installments": 12,
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/create-payment", response_model=PreferenceResponse, include_in_schema=False)
@router.post("/create-preference", response_model=PreferenceResponse)
async def create_preference(
    data: CreatePreferenceIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Creates a MercadoPago preference and returns the checkout URL.
    If order_id is not provided, a new Order is created first.
    """
    sdk = get_mp_sdk()

    # ── Create order if not provided ─────────────────────────────────────────
    if data.order_id:
        order = db.query(models.Order).filter(models.Order.id == data.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
    else:
        order = models.Order(
            user_id=current_user.id,
            status="pending",
            total=data.total,
            address=data.address or {},
            items=[item.dict() for item in data.items],
            shipping_method=data.shipping_method,
            shipping_price=data.shipping_price,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        logger.info(f"Order created: id={order.id} user={current_user.email}")

    # ── Create MP preference ─────────────────────────────────────────────────
    pref_body = _build_preference_body(data, order.id)
    logger.info(f"Creating MP preference for order {order.id}. Body: {pref_body}")

    result = sdk.preference().create(pref_body)

    if result["status"] not in (200, 201):
        logger.error(f"MP preference error. Status: {result.get('status')}. Response: {result.get('response')}")
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao criar preference no MercadoPago: {result.get('response', {})}"
        )

    pref = result["response"]
    preference_id = pref["id"]

    # ── Persist preference_id in order ──────────────────────────────────────
    order.mp_preference_id = preference_id
    db.commit()

    logger.info(f"MP preference created: {preference_id}")

    return PreferenceResponse(
        preference_id=preference_id,
        init_point=pref["init_point"],
        sandbox_init_point=pref["sandbox_init_point"],
        order_id=order.id,
    )


@router.post("/webhook/mercadopago", include_in_schema=False)
@router.post("/webhook")
async def mercadopago_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Receives MercadoPago payment notifications and updates order status.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    logger.info(f"MP Webhook received: {body}")

    topic = body.get("type") or request.query_params.get("topic")
    resource_id = (
        body.get("data", {}).get("id")
        or request.query_params.get("id")
    )

    # MercadoPago sends merchant_order or payment topics
    if topic not in ("payment", "merchant_order") or not resource_id:
        logger.info(f"MP Webhook: ignored topic={topic}")
        return {"status": "ignored"}

    background_tasks.add_task(_process_payment_notification, str(resource_id), topic, db)
    return {"status": "received"}


def _process_payment_notification(resource_id: str, topic: str, db: Session):
    """Background task: fetch payment from MP and update order."""
    sdk = get_mp_sdk()

    try:
        if topic == "payment":
            result = sdk.payment().get(resource_id)
        else:
            result = sdk.merchant_order().get(resource_id)

        if result["status"] != 200:
            logger.error(f"MP payment fetch error: {result}")
            return

        data = result["response"]

        # Extract info depending on topic
        if topic == "payment":
            mp_status        = data.get("status")
            external_ref     = data.get("external_reference")
            payment_id       = str(data.get("id"))
            payer            = data.get("payer", {})
            payer_email      = payer.get("email", "")
            payer_first      = payer.get("first_name", "")
            payer_last       = payer.get("last_name", "")
            payer_name       = f"{payer_first} {payer_last}".strip()
        else:  # merchant_order
            payments = data.get("payments", [])
            approved = [p for p in payments if p.get("status") == "approved"]
            mp_status    = "approved" if approved else data.get("order_status")
            external_ref = data.get("external_reference")
            payment_id   = str(approved[0]["id"]) if approved else ""
            payer_email  = ""
            payer_name   = ""

        if not external_ref:
            logger.warning("MP Webhook: no external_reference found")
            return

        order_id = int(external_ref)
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if not order:
            logger.warning(f"MP Webhook: order {order_id} not found")
            return

        logger.info(f"MP Webhook: order={order_id} status={mp_status}")

        if mp_status == "approved" and order.status != "paid":
            order.status      = "paid"
            order.mp_payment_id = payment_id
            order.buyer_email  = payer_email
            order.buyer_name   = payer_name

            # Update user purchase count / roulette
            user = db.query(models.User).filter(models.User.id == order.user_id).first()
            if user:
                user.total_compras = (user.total_compras or 0) + 1
                config = db.query(models.RouletteConfig).first()
                if config and config.ativa and config.regra_5_compras:
                    if user.total_compras >= 5:
                        user.pode_girar_roleta = True

            db.commit()
            logger.info(f"Order {order_id} marked as PAID by {payer_email}")

        elif mp_status in ("rejected", "cancelled"):
            order.status = "cancelled"
            db.commit()
            logger.info(f"Order {order_id} marked as CANCELLED")

    except Exception as e:
        logger.error(f"Error processing MP notification: {e}", exc_info=True)


@router.get("/status/{order_id}")
async def get_payment_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Poll endpoint for frontend to check payment status after redirect."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    # Allow admin or owner to check
    if current_user.role != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    return {
        "order_id": order.id,
        "status": order.status,
        "buyer_name": getattr(order, "buyer_name", None),
        "buyer_email": getattr(order, "buyer_email", None),
        "total": order.total,
        "items": order.items,
        "created_at": order.created_at,
    }


@router.get("/admin/orders")
async def list_admin_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Admin endpoint: list all orders with buyer info and payment status."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    result = []
    for o in orders:
        user_email = ""
        user_name  = ""
        if o.user_id:
            u = db.query(models.User).filter(models.User.id == o.user_id).first()
            if u:
                user_email = u.email
                user_name  = u.full_name or ""

        result.append({
            "id": o.id,
            "status": o.status,
            "total": o.total,
            "items": o.items or [],
            "address": o.address or {},
            "shipping_method": getattr(o, "shipping_method", None),
            "shipping_price": getattr(o, "shipping_price", 0),
            "buyer_name": getattr(o, "buyer_name", None) or user_name,
            "buyer_email": getattr(o, "buyer_email", None) or user_email,
            "mp_preference_id": getattr(o, "mp_preference_id", None),
            "mp_payment_id": getattr(o, "mp_payment_id", None),
            "correios_label_url": getattr(o, "correios_label_url", None),
            "created_at": o.created_at,
        })
    return result
