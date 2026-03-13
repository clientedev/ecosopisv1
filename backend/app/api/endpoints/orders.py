from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from app.core import mercadopago_service, pdf_service
import io
import os

router = APIRouter()

def _ensure_order_columns(db: Session):
    """Ensure new MP columns exist (safe migration for SQLite)."""
    new_cols = [
        ("payment_method",      "VARCHAR DEFAULT 'pix'"),
        ("shipping_method",     "VARCHAR"),
        ("shipping_price",      "REAL DEFAULT 0"),
        ("mp_payment_id",       "VARCHAR"),
        ("mp_preference_id",    "VARCHAR"),
        ("pix_qr_code",        "TEXT"),
        ("pix_qr_code_base64", "TEXT"),
        ("mp_init_point",      "VARCHAR"),
        ("customer_name",      "VARCHAR"),
        ("customer_email",     "VARCHAR"),
        ("customer_phone",     "VARCHAR"),
        ("coupon_code",        "VARCHAR"),
        ("discount_amount",    "REAL DEFAULT 0"),
    ]
    for col, defn in new_cols:
        try:
            db.execute(text(f"ALTER TABLE orders ADD COLUMN {col} {defn}"))
            db.commit()
        except Exception:
            pass


@router.post("/", response_model=schemas.OrderResponse)
def create_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_order_columns(db)

    # Build the order in the DB first (so we have an ID)
    db_order = models.Order(
        user_id=current_user.id,
        status="pending",
        total=order_in.total,
        address=order_in.address,
        items=[item.dict() for item in order_in.items],
        payment_method=order_in.payment_method,
        shipping_method=order_in.shipping_method,
        shipping_price=order_in.shipping_price or 0.0,
        customer_name=order_in.customer_name or current_user.full_name or "",
        customer_email=current_user.email,
        customer_phone=order_in.customer_phone or "",
        coupon_code=order_in.coupon_code or "",
        discount_amount=order_in.discount_amount or 0.0,
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # Update roulette/purchase counters
    current_user.total_compras = (current_user.total_compras or 0) + 1
    config = db.query(models.RouletteConfig).first()
    if config and config.ativa and config.regra_5_compras:
        if current_user.total_compras >= 5:
            current_user.pode_girar_roleta = True
    db.commit()

    order_items = [item.dict() for item in order_in.items]
    customer_email = current_user.email
    customer_name = order_in.customer_name or current_user.full_name or "Cliente"

    try:
        # Always create a Checkout Pro preference
        # This allows the user to choice PIX, Credit Card, etc on MP site
        mp_result = mercadopago_service.create_checkout_pro_preference(
            order_id=db_order.id,
            total=order_in.total,
            customer_email=customer_email,
            customer_name=customer_name,
            items=order_items,
        )
        db_order.mp_preference_id = mp_result.get("preference_id", "")
        db_order.mp_init_point = mp_result.get("init_point", "")

        # If they specifically asked for PIX, we can still generate it, 
        # but Checkout Pro is more robust for "official" feel like requested.
        if order_in.payment_method == "pix":
            try:
                pix_result = mercadopago_service.create_pix_payment(
                    order_id=db_order.id,
                    total=order_in.total,
                    customer_email=customer_email,
                    customer_name=customer_name,
                    items=order_items,
                )
                db_order.mp_payment_id = pix_result.get("payment_id", "")
                db_order.pix_qr_code = pix_result.get("qr_code", "")
                db_order.pix_qr_code_base64 = pix_result.get("qr_code_base64", "")
            except Exception as e:
                print(f"PIX generation failed but secondary preference is OK: {e}")

        db.commit()
        db.refresh(db_order)

    except Exception as e:
        # Don't fail the order — but record the error in status
        db_order.status = "mp_error"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Erro ao criar pagamento MP: {str(e)}")

    return _order_to_response(db_order)


@router.post("/webhook")
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive payment notifications from Mercado Pago and update order status."""
    try:
        data = await request.json()
        print(f"DEBUG MP Webhook: {data}")
    except Exception:
        return {"status": "ignored"}

    # MP sends different types: payment, merchant_order, etc.
    topic = data.get("type") or data.get("topic", "")
    resource_id = None

    if topic == "payment":
        resource_id = str(data.get("data", {}).get("id") or data.get("id", ""))
    elif topic == "merchant_order":
        # Merchant orders track multiple payments, but for simple flows 'payment' is enough
        return {"status": "ok"}

    if not resource_id:
        return {"status": "ignored"}

    try:
        payment_info = mercadopago_service.get_payment_status(resource_id)
        mp_status = payment_info.get("status", "")
        internal_status = mercadopago_service.MP_STATUS_MAP.get(mp_status, "pending")
        external_ref = payment_info.get("external_reference", "")

        if external_ref:
            order = db.query(models.Order).filter(models.Order.id == int(external_ref)).first()
            if order:
                order.status = internal_status
                order.mp_payment_id = resource_id
                # Record payment method if available in info
                # payment_info might need expanding in service
                db.commit()
    except Exception as e:
        print(f"Webhook error processing {resource_id}: {e}")

    return {"status": "ok"}


@router.get("/admin/all")
def list_all_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    _ensure_order_columns(db)
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    result = []
    for o in orders:
        user = db.query(models.User).filter(models.User.id == o.user_id).first()
        r = _order_to_response(o)
        r["user_email"] = user.email if user else "N/A"
        r["user_name"] = user.full_name if user else "N/A"
        result.append(r)
    return result


@router.get("/{order_id}/label")
def get_order_label(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    order_dict = _order_to_response(order)
    try:
        pdf_bytes = pdf_service.generate_shipping_label_pdf(order_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=etiqueta_pedido_{order_id}.pdf"},
    )


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: int,
    body: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    order.status = body.get("status", order.status)
    db.commit()
    db.refresh(order)
    return _order_to_response(order)


@router.get("/", response_model=List[schemas.OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_order_columns(db)
    if current_user.role != "admin":
        orders = db.query(models.Order).filter(models.Order.user_id == current_user.id).all()
    else:
        orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    return [_order_to_response(o) for o in orders]


@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "admin":
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
    else:
        order = db.query(models.Order).filter(
            models.Order.id == order_id,
            models.Order.user_id == current_user.id
        ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return _order_to_response(order)


@router.post("/subscribe")
def create_subscription(
    sub_in: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_sub = models.Subscription(
        user_id=current_user.id,
        plan_name=sub_in.get("plan_name"),
        status="active"
    )
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return {"id": db_sub.id, "status": "active", "plan_name": db_sub.plan_name}


@router.get("/admin/subscriptions")
def list_all_subscriptions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    subs = db.query(models.Subscription).all()
    return [
        {
            "id": s.id,
            "plan_name": s.plan_name,
            "status": s.status,
            "created_at": s.created_at,
            "user_email": s.user.email if s.user else "N/A",
        }
        for s in subs
    ]


def _order_to_response(o: models.Order) -> dict:
    """Convert an Order model to a dict (handles missing columns gracefully)."""
    items = o.items or []
    return {
        "id": o.id,
        "status": o.status or "pending",
        "total": o.total or 0,
        "items": items,
        "address": o.address,
        "payment_method": getattr(o, "payment_method", None),
        "shipping_method": getattr(o, "shipping_method", None),
        "shipping_price": getattr(o, "shipping_price", None),
        "mp_payment_id": getattr(o, "mp_payment_id", None),
        "mp_preference_id": getattr(o, "mp_preference_id", None),
        "pix_qr_code": getattr(o, "pix_qr_code", None),
        "pix_qr_code_base64": getattr(o, "pix_qr_code_base64", None),
        "mp_init_point": getattr(o, "mp_init_point", None),
        "payment_url": getattr(o, "mp_init_point", None),  # legacy compat
        "customer_name": getattr(o, "customer_name", None),
        "customer_email": getattr(o, "customer_email", None),
        "coupon_code": getattr(o, "coupon_code", None),
        "discount_amount": getattr(o, "discount_amount", None),
        "created_at": o.created_at,
    }
