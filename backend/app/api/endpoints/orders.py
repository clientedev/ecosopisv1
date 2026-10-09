from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
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

class AdminManualOrderItem(BaseModel):
    product_id: Optional[int] = 1
    product_name: str
    quantity: int = 1
    price: float

class AdminManualOrderCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_cpf: Optional[str] = None
    channel: str = "mercadolivre"  # mercadolivre, shopee, whatsapp, balcao, outro
    total: float
    items: List[AdminManualOrderItem]
    shipping_method: Optional[str] = "Mercado Envios"
    shipping_price: Optional[float] = 0.0
    status: Optional[str] = "paid"
    transaction_id: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class ShippingPackageUpdate(BaseModel):
    package_width: Optional[float] = None
    package_height: Optional[float] = None
    package_length: Optional[float] = None
    package_weight: Optional[float] = None
    shipping_service_id: Optional[int] = None
    shipping_method: Optional[str] = None

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
    
    # Clear saved cart JSON on order creation
    current_user.cart_json = None
    current_user.cart_updated_at = None

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
    orders = db.query(models.Order).options(joinedload(models.Order.user)).order_by(models.Order.created_at.desc()).all()
    
    return [_order_to_response(o, db) for o in orders]


@router.post("/admin/manual")
def create_manual_admin_order(
    payload: AdminManualOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Permite ao administrador lançar manualmente uma venda externa
    (Mercado Livre, Shopee, WhatsApp, Balcão/Físico ou outro canal).
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    items_data = [item.dict() for item in payload.items]
    
    default_address = {
        "street": f"Envio via {payload.shipping_method or 'Canal Externo'}",
        "number": "S/N",
        "neighborhood": payload.channel.upper(),
        "city": "Consulte painel externo",
        "state": "BR",
        "postal_code": "00000-000",
        "observacao": payload.notes or f"Venda externa via {payload.channel}."
    }
    final_address = payload.address or default_address

    new_order = models.Order(
        user_id=current_user.id,
        status=payload.status or "paid",
        total=payload.total,
        shipping_price=payload.shipping_price or 0.0,
        shipping_method=payload.shipping_method or ("Mercado Envios" if payload.channel == "mercadolivre" else "Fixo"),
        items=items_data,
        address=final_address,
        payment_method=payload.channel,
        mercadopago_payment_id=payload.transaction_id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email or f"vendas.{payload.channel}@ecosopis.com.br",
        customer_phone=payload.customer_phone,
        customer_cpf=payload.customer_cpf,
        buyer_name=payload.customer_name,
        buyer_email=payload.customer_email or f"vendas.{payload.channel}@ecosopis.com.br",
    )
    db.add(new_order)
    db.flush()

    for item in items_data:
        try:
            oi = models.OrderItem(
                order_id=new_order.id,
                product_id=item.get("product_id") or 1,
                quantity=item.get("quantity") or 1,
                price=float(item.get("price") or 0.0)
            )
            db.add(oi)
        except Exception:
            pass

    db.commit()
    db.refresh(new_order)

    return _order_to_response(new_order, db)


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

    valid_statuses = {"pending", "paid", "shipped", "delivered", "cancelled", "erro_envio", "ERRO_ENVIO", "processando_envio", "PROCESSANDO_ENVIO"}
    new_status = body.get("status", order.status)
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")

    if new_status == "paid" and order.status != "paid":
        if order.status == "pending":
            # Manual payment confirmation must execute the complete shared
            # post-payment flow (metrics, cashback, shipping and emails).
            from app.api.endpoints.payment import finalize_order_on_payment
            finalize_order_on_payment(order, db)
        else:
            # Keep the existing administrative status transition behavior for
            # orders that already went through payment finalization.
            order.status = "paid"
            db.commit()
            db.refresh(order)
    else:
        order.status = new_status
        db.commit()
        db.refresh(order)

    # Send Status Update Email
    try:
        user_email = order.customer_email or (order.user.email if order.user else None)
        if user_email:
            emails.send_order_update_email(user_email, order.id, new_status, getattr(order, "codigo_rastreio", None))
            # If order just got paid, send confirmation email with PDF invoice attached
            if new_status == "paid":
                try:
                    order_dict = _order_to_response(order, db)
                    pdf_bytes = pdf_service.generate_shipping_label_pdf(order_dict)
                    items_for_email = []
                    for item in order_dict.get("items", []):
                        items_for_email.append({
                            "name": item.get("product_name") or item.get("name") or "Item",
                            "quantity": item.get("quantity", 1),
                            "price": item.get("price", 0),
                        })
                    emails.send_order_confirmation_with_pdf(user_email, order.id, items_for_email, order.total, pdf_bytes)
                except Exception as pdf_err:
                    print(f"Error sending order confirmation with PDF: {pdf_err}")
    except Exception as e:
        print(f"Error sending status update email: {e}")

    # Send WhatsApp Notification
    try:
        from app.services.whatsapp import notify_customer_order_shipped, notify_customer_order_delivered, trigger_whatsapp_event
        phone = order.customer_phone or (order.user.phone if order.user else None)
        if phone:
            client_name = order.customer_name or order.buyer_name or (order.user.full_name if order.user else "Cliente")
            
            # Format item names
            item_names = []
            if order.items and isinstance(order.items, list):
                for it in order.items:
                    item_names.append(it.get("product_name") or it.get("name") or "Cosmético Natural")
            items_str = ", ".join(item_names) if item_names else "Cosméticos Ecosopis"

            context = {
                "cliente": client_name,
                "pedido": order.id,
                "valor": f"{order.total:.2f}".replace(".", ","),
                "itens": items_str,
                "codigo_rastreio": order.codigo_rastreio or "Em breve"
            }

            if new_status == "paid":
                trigger_whatsapp_event("order_paid", phone, context, db, recipient_name=client_name)
            elif new_status == "shipped":
                notify_customer_order_shipped(order, db, getattr(order, "codigo_rastreio", None))
            elif new_status == "delivered":
                notify_customer_order_delivered(order, db)
    except Exception as wa_err:
        print(f"Error triggering WhatsApp notification: {wa_err}")

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


@router.patch("/{order_id}/shipping-package")
def update_order_shipping_package(
    order_id: int,
    payload: ShippingPackageUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    if payload.package_width is not None and float(payload.package_width) > 0:
        order.package_width = float(payload.package_width)
    if payload.package_height is not None and float(payload.package_height) > 0:
        order.package_height = float(payload.package_height)
    if payload.package_length is not None and float(payload.package_length) > 0:
        order.package_length = float(payload.package_length)
    if payload.package_weight is not None and float(payload.package_weight) > 0:
        order.package_weight = float(payload.package_weight)
    if payload.shipping_service_id is not None:
        order.shipping_service_id = int(payload.shipping_service_id)
    if payload.shipping_method:
        order.shipping_method = payload.shipping_method

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
    db.query(models.OrderItem).delete()
    db.query(models.Order).delete()
    db.commit()
    return None


@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    db.query(models.OrderItem).filter(models.OrderItem.order_id == order_id).delete()
    db.delete(order)
    db.commit()
    return {"status": "success", "message": f"Pedido #{order_id} excluído com sucesso"}


@router.get("/", response_model=List[schemas.OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        orders = db.query(models.Order).options(joinedload(models.Order.user)).filter(
            models.Order.user_id == current_user.id
        ).order_by(models.Order.created_at.desc()).all()
    else:
        orders = db.query(models.Order).options(joinedload(models.Order.user)).order_by(models.Order.created_at.desc()).all()

    return [_order_to_response(o, db) for o in orders]


@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "admin":
        order = db.query(models.Order).options(joinedload(models.Order.user)).filter(models.Order.id == order_id).first()
    else:
        order = db.query(models.Order).options(joinedload(models.Order.user)).filter(
            models.Order.id == order_id,
            models.Order.user_id == current_user.id
        ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    # Proactive payment sync
    if order.status == "pending":
        repo = OrderRepository(db)
        service = OrderService(repo)
        if getattr(order, "stripe_session_id", None):
            service.sync_order_status(order.id)
            db.commit()
            db.refresh(order)
        elif getattr(order, "mercadopago_preference_id", None):
            service.sync_mp_order_status(order.id)
            db.commit()
            db.refresh(order)

    # Proactive shipping sync with Melhor Envio if paid or shipped
    if order.status in ("paid", "shipped", "processando_envio", "erro_envio") and getattr(order, "shipment_id", None):
        try:
            from app.services.melhorenvio_service import sync_melhor_envio_status
            sync_melhor_envio_status(order, db)
            db.refresh(order)
        except Exception as me_err:
            pass

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

    if (not buyer_name or not buyer_email) and o.user_id:
        user = getattr(o, "user", None)
        if not user and db:
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
        "mercadopago_payment_id": getattr(o, "mercadopago_payment_id", None),
        "mercadopago_preference_id": getattr(o, "mercadopago_preference_id", None),
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
        "package_width": getattr(o, "package_width", None),
        "package_height": getattr(o, "package_height", None),
        "package_length": getattr(o, "package_length", None),
        "package_weight": getattr(o, "package_weight", None),
        "shipping_service_id": getattr(o, "shipping_service_id", None),
        "created_at": o.created_at,
    }
