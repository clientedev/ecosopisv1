from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from app.core import pdf_service, emails
from app.repositories.order_repository import OrderRepository
from app.services.order_service import OrderService
import io
import os

router = APIRouter()

router = APIRouter()

@router.post("/", response_model=schemas.OrderResponse)
def create_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):

    repo = OrderRepository(db)
    items_json = [item.dict() for item in order_in.items]
    
    db_order = repo.create_order(
        user_id=current_user.id,
        status="pending",
        total=order_in.total,
        shipping_price=order_in.shipping_price or 20.0,
        shipping_method=order_in.shipping_method or "fixo",
        items=items_json,
        address=order_in.address,
        coupon_code=order_in.coupon_code or "",
        discount_amount=order_in.discount_amount or 0.0
    )
    
    # Also populate relational table
    repo.add_order_items(db_order.id, items_json)
    
    # Extra customer info
    db_order.customer_name = order_in.customer_name or current_user.full_name or ""
    db_order.customer_email = current_user.email
    db_order.customer_phone = order_in.customer_phone or ""
    db_order.payment_method = order_in.payment_method or "stripe"
    
    db.commit()
    db.refresh(db_order)

    return _order_to_response(db_order, db)


@router.get("/admin/all")
def list_all_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    
    # Proactive sync for pending orders
    repo = OrderRepository(db)
    service = OrderService(repo)
    for o in orders:
        if o.status == "pending" and o.stripe_session_id:
            service.sync_order_status(o.id)
            db.commit()
            db.refresh(o)

    result = []
    for o in orders:
        r = _order_to_response(o, db)
        result.append(r)
    return result


@router.get("/{order_id}/label")
def get_order_label(
    order_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    order_dict = _order_to_response(order, db)
    try:
        pdf_bytes = pdf_service.generate_shipping_label_pdf(order_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=ticket_pedido_{order_id}.pdf"},
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

    valid_statuses = {"pending", "paid", "shipped", "delivered", "cancelled"}
    new_status = body.get("status", order.status)
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")

    if new_status == "paid" and order.status != "paid":
        from app.api.endpoints.payment import finalize_order_on_payment
        finalize_order_on_payment(order, db)
    else:
        order.status = new_status
        db.commit()
        db.refresh(order)

    # Send Status Update Email
    try:
        user_email = order.customer_email or (order.user.email if order.user else None)
        if user_email:
            emails.send_order_update_email(user_email, order.id, new_status)
    except Exception as e:
        print(f"Error sending status update email: {e}")

    return _order_to_response(order, db)


@router.patch("/{order_id}/address")
def update_order_address(
    order_id: int,
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    # The body should contain the new address dictionary, or fields to merge
    if "address" in body:
        new_address = body["address"]
    else:
        new_address = body

    # We enforce dict replacement or merging
    current_address = order.address or {}
    current_address.update(new_address)
    
    # SQLAlchemy JSON objects must be reassigned strongly
    order.address = dict(current_address)
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(order, "address")
    
    db.commit()
    db.refresh(order)
    
    return _order_to_response(order, db)



@router.delete("/admin/clear-all", status_code=204)
def clear_all_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Delete all orders. Relational order_items should cascade delete if configured, 
    # but we can also do it explicitly to be safe if needed.
    # Base on models.py, order_items has cascade="all, delete-orphan".
    db.query(models.Order).delete()
    db.commit()
    return None


@router.get("/", response_model=List[schemas.OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        orders = db.query(models.Order).filter(
            models.Order.user_id == current_user.id
        ).order_by(models.Order.created_at.desc()).all()
    else:
        orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    
    # Proactive sync for pending orders
    repo = OrderRepository(db)
    service = OrderService(repo)
    for o in orders:
        if o.status == "pending" and o.stripe_session_id:
            service.sync_order_status(o.id)
            db.commit()
            db.refresh(o)

    return [_order_to_response(o, db) for o in orders]


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
    
    # Proactive sync
    if order.status == "pending" and order.stripe_session_id:
        repo = OrderRepository(db)
        service = OrderService(repo)
        service.sync_order_status(order.id)
        db.commit()
        db.refresh(order)

    return _order_to_response(order, db)


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


def _order_to_response(o: models.Order, db: Session = None) -> dict:
    """Convert an Order model to a dict (handles missing columns gracefully)."""
    items = o.items or []
    
    # Fallback for orders created via v2 architecture that didn't populate the JSON column
    if not items and hasattr(o, 'order_items') and o.order_items:
        items = [
            {
                "product_id": item.product_id,
                "product_name": item.product_name, # uses the @property
                "quantity": item.quantity,
                "price": item.price
            }
            for item in o.order_items
        ]

    # Get user info for buyer fields
    buyer_name = getattr(o, "buyer_name", None) or getattr(o, "customer_name", None) or ""
    buyer_email = getattr(o, "buyer_email", None) or getattr(o, "customer_email", None) or ""

    if (not buyer_name or not buyer_email) and o.user_id and db:
        user = db.query(models.User).filter(models.User.id == o.user_id).first()
        if user:
            if not buyer_name:
                buyer_name = user.full_name or ""
            if not buyer_email:
                buyer_email = user.email or ""

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
        "customer_name": buyer_name,
        "customer_email": buyer_email,
        "customer_phone": getattr(o, "customer_phone", None),
        "customer_cpf": getattr(o, "customer_cpf", None),
        "buyer_name": buyer_name,
        "buyer_email": buyer_email,
        "user_name": buyer_name,
        "user_email": buyer_email,
        "coupon_code": getattr(o, "coupon_code", None),
        "discount_amount": getattr(o, "discount_amount", None),
        "correios_label_url": getattr(o, "correios_label_url", None),
        "etiqueta_url": getattr(o, "etiqueta_url", None) or getattr(o, "correios_label_url", None),
        "shipment_id": getattr(o, "shipment_id", None),
        "codigo_rastreio": getattr(o, "codigo_rastreio", None),
        "created_at": o.created_at,
    }
