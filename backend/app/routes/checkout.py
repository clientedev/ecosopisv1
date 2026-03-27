from fastapi import APIRouter, Depends, HTTPException, Request, Body
from pydantic import BaseModel
from typing import List, Optional
import json

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.endpoints.auth import get_current_user
from app.models.models import User
from app.repositories.order_repository import OrderRepository
from app.services.order_service import OrderService
from app.services.stripe_service import StripeService

router = APIRouter()

class CartItemModel(BaseModel):
    product_id: int
    quantity: int
    price: float

class CheckoutRequestModel(BaseModel):
    items: List[CartItemModel]
    shipping_price: float
    shipping_method_id: str
    address_info: dict # dict with keys: postal_code, street, number, etc
    return_url: str = "http://localhost:3000"
    coupon_code: Optional[str] = None

@router.post("/checkout")
async def checkout(
    checkout_data: CheckoutRequestModel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    1. Recebe itens do carrinho
    2. Valida cupom se houver
    3. Cria pedido pending e order_items
    4. Cria Stripe Checkout Session (salvando pedido_id na metadata)
    5. Retorna URL do checkout
    """
    if not checkout_data.items:
        raise HTTPException(status_code=400, detail="Carrinho vazio.")
        
    repo = OrderRepository(db)
    service = OrderService(repo)
    
    # 2. Validação de Cupom
    coupon_code = None
    discount_amount = 0.0
    
    if checkout_data.coupon_code:
        from app.models import models as app_models
        from datetime import datetime, timezone
        
        coupon = db.query(app_models.Coupon).filter(
            app_models.Coupon.code == checkout_data.coupon_code.upper(),
            app_models.Coupon.is_active == True
        ).first()
        
        if not coupon:
            raise HTTPException(status_code=400, detail="Cupom inválido ou inativo")
            
        if coupon.valid_until and coupon.valid_until < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Este cupom já expirou")
            
        if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
            raise HTTPException(status_code=400, detail="Este cupom atingiu o limite de uso")
            
        subtotal = sum(item.price * item.quantity for item in checkout_data.items)
        if coupon.min_purchase_value > subtotal:
            raise HTTPException(status_code=400, detail=f"Compra mínima de R$ {coupon.min_purchase_value} necessária para este cupom")
            
        coupon_code = coupon.code
        if coupon.discount_type == "percentage":
            discount_amount = (subtotal * coupon.discount_value) / 100
        else:
            discount_amount = coupon.discount_value
            
        # Increment usage count
        coupon.usage_count += 1
        db.add(coupon)
    
    # map items to dict as expected by service
    items_list = [item.dict() for item in checkout_data.items]
    
    try:
        resultado = service.create_checkout(
            user_id=current_user.id,
            items=items_list,
            shipping_price=checkout_data.shipping_price,
            shipping_method_id=checkout_data.shipping_method_id,
            address_info=checkout_data.address_info,
            return_url=checkout_data.return_url,
            coupon_code=coupon_code,
            discount_amount=discount_amount
        )
        # SQLAlchemy flush is handled, but we need to commit the transaction
        db.commit()
        return resultado
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook da Stripe
    1. Valida assinatura
    2. Trata checkout.session.completed
    3. Extrai pedido_id e repassa pro OrderService
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = StripeService.validar_webhook(payload, sig_header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Handle event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        pedido_id_str = session.metadata.get("pedido_id")
        if not pedido_id_str:
            print("Webhook sem pedido_id no metadata")
            return {"status": "ignored", "reason": "no pedido_id"}
            
        try:
            pedido_id = int(pedido_id_str)
            repo = OrderRepository(db)
            service = OrderService(repo)
            
            # Executa a regra de negócio (Atualizar para pago + Criar Envio)
            service.handle_payment_success(pedido_id)
            db.commit()
            print(f"Webhook processado para pedido {pedido_id}")
            
        except Exception as e:
            db.rollback()
            print(f"Erro processando webhook: {e}")
            raise HTTPException(status_code=500, detail="Error processing webhook")

    return {"status": "success"}
