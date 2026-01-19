from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.OrderResponse)
def create_order(order_in: schemas.OrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Simulação de criação de pedido e processamento de pagamento
    db_order = models.Order(
        user_id=current_user.id,
        status="pending",
        total=order_in.total,
        address=order_in.address,
        items=[item.dict() for item in order_in.items]
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # Simulação de dados de pagamento baseado no método
    pix_code = None
    payment_url = None
    
    if order_in.payment_method == "pix":
        pix_code = f"00020126580014BR.GOV.BCB.PIX0136{uuid.uuid4()}52040000530398654041.005802BR5913ECOSOPIS6008SAOPAULO62070503***6304E2CA"
    else:
        payment_url = f"https://checkout.stripe.com/pay/{uuid.uuid4()}"
        
    return {
        "id": db_order.id,
        "status": db_order.status,
        "total": db_order.total,
        "items": order_in.items,
        "pix_code": pix_code,
        "payment_url": payment_url,
        "created_at": db_order.created_at
    }

@router.get("/", response_model=List[schemas.OrderResponse])
def list_orders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        return db.query(models.Order).filter(models.Order.user_id == current_user.id).all()
    return db.query(models.Order).all()

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return order
