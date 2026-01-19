from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from pydantic import BaseModel
import shutil
import os
import uuid

router = APIRouter()

class AnnouncementUpdate(BaseModel):
    text: str
    bg_color: str
    text_color: str
    is_active: bool

@router.get("/announcement")
def get_announcement(db: Session = Depends(get_db)):
    announcement = db.query(models.AnnouncementBar).first()
    if not announcement:
        announcement = models.AnnouncementBar(
            text="Bem-vinda à ECOSOPIS! Frete grátis em compras acima de R$ 150",
            bg_color="#2d5a27",
            text_color="#ffffff",
            is_active=True
        )
        db.add(announcement)
        db.commit()
        db.refresh(announcement)
    return announcement

@router.put("/announcement")
def update_announcement(data: AnnouncementUpdate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    announcement = db.query(models.AnnouncementBar).first()
    if not announcement:
        announcement = models.AnnouncementBar()
        db.add(announcement)
    
    announcement.text = data.text
    announcement.bg_color = data.bg_color
    announcement.text_color = data.text_color
    announcement.is_active = data.is_active
    
    db.commit()
    db.refresh(announcement)
    return announcement

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    admin: models.User = Depends(get_current_admin)
):
    file_extension = os.path.splitext(file.filename or "")[1]
    file_name = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join("static/uploads", file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/static/uploads/{file_name}"}

class SubscriptionUpdate(BaseModel):
    shipping_status: str

@router.get("/subscriptions/all")
def list_all_subscriptions(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    return db.query(models.Subscription).all()

@router.put("/subscriptions/{sub_id}/shipping")
def update_shipping_status(sub_id: int, data: SubscriptionUpdate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    sub = db.query(models.Subscription).filter(models.Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.shipping_status = data.shipping_status
    db.commit()
    db.refresh(sub)
    return sub

@router.get("", response_model=List[schemas.ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@router.get("/{slug}", response_model=schemas.ProductResponse)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/", response_model=schemas.ProductResponse)
def create_product(
    product_in: schemas.ProductCreate, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_product = models.Product(**product_in.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_in: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product
