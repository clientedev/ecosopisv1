from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from app.core import pdf_service
import io
import os

router = APIRouter()

def _ensure_order_columns(db: Session):
    """Ensure new Stripe columns exist (safe migration)."""
    new_cols = [
        ("payment_method",       "VARCHAR DEFAULT 'stripe'"),
        ("shipping_method",      "VARCHAR"),
        ("shipping_price",       "REAL DEFAULT 0"),
        ("stripe_payment_id",    "VARCHAR"),
        ("stripe_session_id",    "VARCHAR"),
        ("customer_name",        "VARCHAR"),
        ("customer_email",       "VARCHAR"),
        ("customer_phone",       "VARCHAR"),
        ("coupon_code",          "VARCHAR"),
        ("discount_amount",      "REAL DEFAULT 0"),
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
        payment_method=order_in.payment_method or "stripe",
        shipping_method=order_in.shipping_method or "fixo",
        shipping_price=order_in.shipping_price or 20.0,
        customer_name=order_in.customer_name or current_user.full_name or "",
        customer_email=current_user.email,
        customer_phone=order_in.customer_phone or "",
        coupon_code=order_in.coupon_code or "",
        discount_amount=order_in.discount_amount or 0.0,
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    return _order_to_response(db_order)


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
        "stripe_payment_id": getattr(o, "stripe_payment_id", None),
        "stripe_session_id": getattr(o, "stripe_session_id", None),
        "payment_url": None,
        "customer_name": getattr(o, "customer_name", None),
        "customer_email": getattr(o, "customer_email", None),
        "coupon_code": getattr(o, "coupon_code", None),
        "discount_amount": getattr(o, "discount_amount", None),
        "created_at": o.created_at,
    }
