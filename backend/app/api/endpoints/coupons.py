from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin

router = APIRouter()

@router.get("/", response_model=List[schemas.CouponResponse])
def list_coupons(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    return db.query(models.Coupon).all()

@router.post("/", response_model=schemas.CouponResponse)
def create_coupon(coupon_in: schemas.CouponCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_coupon = models.Coupon(**coupon_in.dict())
    db.add(db_coupon)
    db.commit()
    db.refresh(db_coupon)
    return db_coupon

@router.put("/{coupon_id}", response_model=schemas.CouponResponse)
def update_coupon(coupon_id: int, coupon_in: schemas.CouponUpdate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_coupon = db.query(models.Coupon).filter(models.Coupon.id == coupon_id).first()
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    update_data = coupon_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_coupon, key, value)
    
    db.commit()
    db.refresh(db_coupon)
    return db_coupon

@router.delete("/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coupon(coupon_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_coupon = db.query(models.Coupon).filter(models.Coupon.id == coupon_id).first()
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(db_coupon)
    db.commit()
    return None

@router.get("/validate/{code}", response_model=schemas.CouponResponse)
def validate_coupon(code: str, db: Session = Depends(get_db)):
    coupon = db.query(models.Coupon).filter(models.Coupon.code == code, models.Coupon.is_active == True).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupom inválido ou expirado")
    
    if coupon.valid_until and coupon.valid_until < datetime.now():
        raise HTTPException(status_code=400, detail="Este cupom já expirou")
    
    if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
        raise HTTPException(status_code=400, detail="Este cupom atingiu o limite de uso")
    
    return coupon
