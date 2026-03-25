"""
Payment module — Stripe Checkout integration
"""
import os
import logging
from typing import Any, Dict, List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.stripe_service import create_checkout_session, verify_webhook_signature
from app.models import models
from app.api.endpoints.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "")

# ── Pydantic schemas ─────────────────────────────────────────────────────────
class CheckoutItemIn(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float


class CreateCheckoutIn(BaseModel):
    order_id: Optional[int] = None
    items: List[CheckoutItemIn]
    total: float
    address: Optional[Dict[str, Any]] = None
    shipping_method: Optional[str] = "fixo"
    shipping_price: Optional[float] = 20.0
    coupon_code: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    discount_amount: Optional[float] = 0.0


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    order_id: int


class StatusUpdateIn(BaseModel):
    status: str


# ── Helper ────────────────────────────────────────────────────────────────────

def _resolve_frontend_url(request: Request) -> str:
    """Determine the frontend URL from request headers or env var."""
    # 1. Explicit env var (highest priority)
    if FRONTEND_URL:
        return FRONTEND_URL.rstrip("/")

    # 2. From Origin header (browser sends this on POST)
    origin = request.headers.get("origin")
    if origin and "localhost" not in origin:
        return origin.rstrip("/")

    # 3. From Referer header
    referer = request.headers.get("referer")
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        base = f"{parsed.scheme}://{parsed.netloc}"
        if "localhost" not in base:
            return base.rstrip("/")

    # 4. Fallback
    return "http://localhost:3000"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/create-payment", response_model=CheckoutResponse, include_in_schema=False)
@router.post("/create-preference", response_model=CheckoutResponse)
async def create_stripe_checkout(
    data: CreateCheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Creates a Stripe Checkout Session and returns the checkout URL.
    If order_id is not provided, a new Order is created first.
    """
    # Fixed shipping price for now
    shipping_price = data.shipping_price if data.shipping_price is not None else 20.0

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
            payment_method="stripe",
            shipping_method=data.shipping_method or "fixo",
            shipping_price=shipping_price,
            customer_name=data.customer_name or current_user.full_name or "",
            customer_email=current_user.email,
            customer_phone=data.customer_phone or "",
            coupon_code=data.coupon_code or "",
            discount_amount=data.discount_amount or 0.0,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        logger.info(f"Order created: id={order.id} user={current_user.email}")

    # ── Dynamic frontend URL for Stripe redirects ────────────────────────────
    frontend_url = _resolve_frontend_url(request)
    logger.info(f"Using frontend URL for Stripe redirects: {frontend_url}")

    # ── Create Stripe Checkout Session ───────────────────────────────────────
    try:
        items_for_stripe = [item.dict() for item in data.items]
        result = create_checkout_session(
            order_id=order.id,
            items=items_for_stripe,
            shipping_price=shipping_price,
            frontend_url=frontend_url,
        )
        order.stripe_session_id = result["session_id"]
        db.commit()

        logger.info(f"Stripe session created: {result['session_id']} for order {order.id}")

        return CheckoutResponse(
            checkout_url=result["checkout_url"],
            session_id=result["session_id"],
            order_id=order.id,
        )
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}", exc_info=True)
        order.status = "payment_error"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Erro ao criar sessão Stripe: {str(e)}")


@router.post("/webhook/stripe")
@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Receives Stripe webhook events and updates order status.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        logger.warning("Stripe webhook: missing stripe-signature header")
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = verify_webhook_signature(payload, sig_header)
    except stripe.error.SignatureVerificationError as e:
        print(f"❌ STRIPE WEBHOOK SIGNATURE ERROR: {e}")
        print("💡 THE NEXT.JS PROXY REWRITE MIGHT BE CORRUPTING THE BODY. USE THE RAILWAY BACKEND URL DIRECTLY IN STRIPE DASHBOARD -> https://YOUR-BACKEND.up.railway.app/payment/webhook/stripe")
        logger.error(f"Stripe webhook signature error: {e}")
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {str(e)}")
    except Exception as e:
        print(f"❌ STRIPE WEBHOOK GENERAL ERROR: {e}")
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    print(f"✅ Stripe webhook successfully verified: type={event['type']}")
    logger.info(f"Stripe webhook received: type={event['type']}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        pedido_id = session.get("metadata", {}).get("pedido_id")

        if not pedido_id:
            logger.warning("Stripe webhook: no pedido_id in metadata")
            return {"status": "ignored"}

        order = db.query(models.Order).filter(models.Order.id == int(pedido_id)).first()
        if not order:
            logger.warning(f"Stripe webhook: order {pedido_id} not found")
            return {"status": "ignored"}

        if order.status != "paid":
            order.status = "paid"
            order.stripe_payment_id = session.get("payment_intent", "")
            order.stripe_session_id = session.get("id", "")
            order.buyer_email = session.get("customer_details", {}).get("email", "")
            order.buyer_name = session.get("customer_details", {}).get("name", "")

            # Update user purchase count / roulette
            user = db.query(models.User).filter(models.User.id == order.user_id).first()
            if user:
                user.total_compras = (user.total_compras or 0) + 1
                config = db.query(models.RouletteConfig).first()
                if config and config.ativa and config.regra_5_compras:
                    if user.total_compras >= 5:
                        user.pode_girar_roleta = True

            db.commit()
            logger.info(f"Order {pedido_id} marked as PAID via Stripe")

    elif event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        pedido_id = session.get("metadata", {}).get("pedido_id")
        if pedido_id:
            order = db.query(models.Order).filter(models.Order.id == int(pedido_id)).first()
            if order and order.status == "pending":
                order.status = "cancelled"
                db.commit()
                logger.info(f"Order {pedido_id} cancelled (session expired)")

    return {"status": "ok"}


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
        "address": order.address,
        "shipping_method": getattr(order, "shipping_method", None),
        "shipping_price": getattr(order, "shipping_price", None),
        "stripe_payment_id": getattr(order, "stripe_payment_id", None),
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
        user_name = ""
        if o.user_id:
            u = db.query(models.User).filter(models.User.id == o.user_id).first()
            if u:
                user_email = u.email
                user_name = u.full_name or ""

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
            "customer_phone": getattr(o, "customer_phone", None),
            "stripe_session_id": getattr(o, "stripe_session_id", None),
            "stripe_payment_id": getattr(o, "stripe_payment_id", None),
            "correios_label_url": getattr(o, "correios_label_url", None),
            "coupon_code": getattr(o, "coupon_code", None),
            "discount_amount": getattr(o, "discount_amount", 0),
            "created_at": o.created_at,
        })
    return result


@router.patch("/admin/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    body: StatusUpdateIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Admin endpoint: update order status (paid → shipped → delivered)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    valid_statuses = {"pending", "paid", "shipped", "delivered", "cancelled"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    order.status = body.status
    db.commit()
    db.refresh(order)

    logger.info(f"Admin updated order {order_id} status to '{body.status}'")
    return {"id": order.id, "status": order.status, "message": "Status atualizado com sucesso"}
