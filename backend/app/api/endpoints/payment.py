import os
import logging
from typing import Any, Dict, List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.endpoints.auth import get_current_user
from app.repositories.order_repository import OrderRepository
from app.core.stripe_service import create_checkout_session, verify_webhook_signature, get_session
from app.core.mercadopago_service import create_checkout_pro_preference, get_payment_status as get_mp_payment_status
from app.services.melhorenvio_service import processar_envio
from app.models import models
from app.core import emails
from app.api.endpoints.cashback import create_cashback_for_order

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
    customer_cpf: Optional[str] = None
    discount_amount: Optional[float] = 0.0
    cashback_amount: Optional[float] = 0.0


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: Optional[str] = None
    preference_id: Optional[str] = None
    order_id: int


class StatusUpdateIn(BaseModel):
    status: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_frontend_url(request: Request) -> str:
    if FRONTEND_URL:
        return FRONTEND_URL.rstrip("/")
    origin = request.headers.get("origin")
    if origin and "localhost" not in origin:
        return origin.rstrip("/")
    return "http://localhost:3000"


def _get_or_create_order(data: CreateCheckoutIn, current_user: models.User, db: Session, payment_method: str) -> models.Order:
    repo = OrderRepository(db)
    if data.order_id:
        order = repo.get_order_by_id(data.order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
        order.payment_method = payment_method
    else:
        order = repo.create_order(
            user_id=current_user.id,
            total=data.total,
            shipping_price=data.shipping_price or 0.0,
            shipping_method=data.shipping_method or "fixo",
            items=[item.dict() for item in data.items],
            address=data.address or {},
            status="pending",
            coupon_code=data.coupon_code or "",
            discount_amount=data.discount_amount or 0.0,
            customer_cpf=data.customer_cpf
        )
        repo.add_order_items(order.id, [item.dict() for item in data.items])
        
        order.payment_method = payment_method
        order.customer_name = data.customer_name or current_user.full_name or ""
        order.customer_email = current_user.email
        order.customer_phone = data.customer_phone or ""
        
    db.commit()
    db.refresh(order)
    return order


def finalize_order_on_payment(order: models.Order, db: Session, payment_id: str = None, session_id: str = None, buyer_email: str = None, buyer_name: str = None):
    """
    Shared logic to handle successful payment:
    1. Mark order as paid.
    2. Update buyer info.
    3. Update user metrics (total purchases, roulette).
    4. Process Cashback.
    5. GENERATE SHIPPING LABEL (Melhor Envio).
    6. Send Confirmation Emails.
    """
    if order.status == "paid":
        logger.info(f"Order {order.id} already marked as PAID. Skipping redundancy.")
        return

    order.status = "paid"
    if payment_id:
        if order.payment_method == "stripe":
            order.stripe_payment_id = payment_id
        else:
            order.mercadopago_payment_id = payment_id
            
    if session_id:
        order.stripe_session_id = session_id
        
    if buyer_email: order.buyer_email = buyer_email
    if buyer_name: order.buyer_name = buyer_name

    # Update user purchase count / roulette
    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user:
        user.total_compras = (user.total_compras or 0) + 1
        config = db.query(models.RouletteConfig).first()
        if config and config.ativa and config.regra_5_compras:
            if user.total_compras >= 5:
                user.pode_girar_roleta = True
        
        # Cashback logic
        try:
            create_cashback_for_order(db, order, user)
        except Exception as e:
            logger.error(f"Error processing cashback for order {order.id}: {e}")

    db.commit()
    logger.info(f"Order {order.id} status updated to PAID via {order.payment_method}")

    # ── LOGISTICS: MELHOR ENVIO ──────────────────────────────────────────────
    try:
        logger.info(f"Starting Melhor Envio processing for order {order.id}...")
        envio_res = processar_envio(order, db)
        if envio_res.get("erro"):
            logger.warning(f"Shipping processing had issues for order {order.id}: {envio_res['erro']}")
        else:
            logger.info(f"Shipping label generated for order {order.id}: {envio_res.get('tracking_code')}")
    except Exception as e:
        logger.error(f"Critical error on shipping integration for order {order.id}: {e}", exc_info=True)

    # ── EMAIL NOTIFICATIONS ──────────────────────────────────────────────────
    try:
        items_data = order.items or []
        if not items_data and order.order_items:
            items_data = [{"name": item.product.name, "quantity": item.quantity, "price": item.price} for item in order.order_items]
        
        emails.send_order_confirmation_email(
            email=order.buyer_email or order.customer_email,
            order_id=order.id,
            items=items_data,
            total=order.total
        )
        
        admin_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "admin_order_notification_email").first()
        admin_email = admin_setting.value if admin_setting else "contato@ecosopis.com.br"
        emails.send_admin_notification_email(
            admin_email=admin_email,
            order_id=order.id,
            total=order.total,
            customer_name=order.buyer_name or order.customer_name
        )
    except Exception as e:
        logger.error(f"Error sending confirmation emails for order {order.id}: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/create-stripe-checkout", response_model=CheckoutResponse)
@router.post("/create-payment", include_in_schema=False)
async def create_stripe_payment(
    data: CreateCheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        order = _get_or_create_order(data, current_user, db, "stripe")
        frontend_url = _resolve_frontend_url(request)

        items_for_stripe = [item.dict() for item in data.items]
        result = create_checkout_session(
            order_id=order.id,
            items=items_for_stripe,
            shipping_price=order.shipping_price,
            frontend_url=frontend_url,
        )
        order.stripe_session_id = result["session_id"]
        db.commit()

        return CheckoutResponse(
            checkout_url=result["checkout_url"],
            session_id=result["session_id"],
            order_id=order.id,
        )
    except Exception as e:
        db.rollback()
        logger.error(f"FATAL CHECKOUT ERROR (Stripe): {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Erro interno no checkout (Stripe): {type(e).__name__} - {str(e)}"
        )


@router.post("/create-mercadopago-checkout", response_model=CheckoutResponse)
@router.post("/create-preference", include_in_schema=False)
async def create_mp_payment(
    data: CreateCheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        order = _get_or_create_order(data, current_user, db, "mercadopago")
        
        items_for_mp = [item.dict() for item in data.items]
        # Include shipping as an item in MP if needed, or handle in service
        preference = create_checkout_pro_preference(
            order_id=order.id,
            items=items_for_mp,
            shipping_price=order.shipping_price,
            customer_email=current_user.email
        )
        
        order.mercadopago_preference_id = preference["id"]
        db.commit()

        return CheckoutResponse(
            checkout_url=preference["init_point"],
            preference_id=preference["id"],
            order_id=order.id,
        )
    except Exception as e:
        db.rollback()
        logger.error(f"FATAL CHECKOUT ERROR (MP): {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Erro interno no checkout (MP): {type(e).__name__} - {str(e)}"
        )


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = verify_webhook_signature(payload, sig_header)
    except Exception as e:
        logger.error(f"Stripe Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] in ["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"]:
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        pedido_id = metadata.get("pedido_id")
        
        if pedido_id:
            order = db.query(models.Order).filter(models.Order.id == int(pedido_id)).first()
            if order:
                cust_det = session.get("customer_details") or {}
                finalize_order_on_payment(
                    order=order, 
                    db=db, 
                    payment_id=session.get("payment_intent"),
                    session_id=session.get("id"),
                    buyer_email=cust_det.get("email"),
                    buyer_name=cust_det.get("name")
                )
    return {"status": "ok"}


@router.post("/webhook/mercadopago")
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives notification from Mercado Pago (topic: merchant_order or payment).
    """
    data = await request.json()
    logger.info(f"MP Webhook received: {data}")

    resource_id = data.get("data", {}).get("id") or data.get("id")
    topic = data.get("type") or data.get("topic")

    if topic == "payment" and resource_id:
        try:
            payment_info = get_mp_payment_status(str(resource_id))
            if payment_info.get("status") == "approved":
                pedido_id = payment_info.get("external_reference")
                if pedido_id:
                    order = db.query(models.Order).filter(models.Order.id == int(pedido_id)).first()
                    if order:
                        finalize_order_on_payment(
                            order=order,
                            db=db,
                            payment_id=str(resource_id),
                            buyer_email=payment_info.get("payer", {}).get("email")
                        )
        except Exception as e:
            logger.error(f"Error processing MP payment {resource_id}: {e}")

    return {"status": "ok"}


@router.get("/status/{order_id}")
async def get_payment_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(status_code=404)
    if current_user.role != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403)

    payment_details = {}
    if order.status == "pending":
        if order.payment_method == "stripe" and order.stripe_session_id:
            try:
                session = get_session(order.stripe_session_id)
                pi = session.get("payment_intent")
                if pi and isinstance(pi, dict) and pi.get("next_action"):
                    action = pi["next_action"]
                    if action.get("type") == "pix_display_qr_code":
                        d = action["pix_display_qr_code"]
                        payment_details = {"method": "pix", "qr_code_url": d.get("image_url_png"), "qr_code_data": d.get("data")}
                    elif action.get("type") == "boleto_display_details":
                        d = action["boleto_display_details"]
                        payment_details = {"method": "boleto", "url": d.get("hosted_voucher_url"), "number": d.get("number")}
            except: pass
        # Potentially add MP pending details if needed

    return {
        "order_id": order.id,
        "status": order.status,
        "total": order.total,
        "payment_method": order.payment_method,
        "payment_details": payment_details,
        "tracking_code": getattr(order, "codigo_rastreio", None),
        "etiqueta_url": getattr(order, "etiqueta_url", None)
    }

# Admin list and Patch status kept for backwards compat
@router.get("/admin/orders")
async def list_admin_orders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin": raise HTTPException(status_code=403)
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    return [{
        "id": o.id, "status": o.status, "total": o.total, "payment_method": o.payment_method,
        "buyer_name": o.buyer_name or o.customer_name, "created_at": o.created_at,
        "tracking_code": o.codigo_rastreio, "etiqueta_url": o.etiqueta_url
    } for o in orders]

@router.patch("/admin/orders/{order_id}/status")
async def update_order_status(order_id: int, body: StatusUpdateIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin": raise HTTPException(status_code=403)
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(status_code=404)
    order.status = body.status
    db.commit()
    return {"status": "ok"}
