from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from pydantic import BaseModel
import uuid

router = APIRouter()

class AnnouncementUpdate(BaseModel):
    text: str
    bg_color: str
    text_color: str
    is_active: bool
    is_scrolling: bool = False
    repeat_text: bool = True
    scroll_speed: int = 20

@router.get("/announcement")
def get_announcement(db: Session = Depends(get_db)):
    try:
        announcement = db.query(models.AnnouncementBar).first()
        if not announcement:
            announcement = models.AnnouncementBar(
                text="Bem-vinda à ECOSOPIS! Frete grátis em compras acima de R$ 150",
                bg_color="#2d5a27",
                text_color="#ffffff",
                is_active=True,
                is_scrolling=False,
                repeat_text=True,
                scroll_speed=20
            )
            db.add(announcement)
            db.commit()
            db.refresh(announcement)
        return announcement
    except Exception as e:
        print(f"Error in get_announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/announcement")
def update_announcement(data: AnnouncementUpdate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    try:
        announcement = db.query(models.AnnouncementBar).first()
        if not announcement:
            announcement = models.AnnouncementBar(text=data.text)
            db.add(announcement)
        
        announcement.text = data.text
        announcement.bg_color = data.bg_color
        announcement.text_color = data.text_color
        announcement.is_active = data.is_active
        announcement.is_scrolling = data.is_scrolling
        announcement.repeat_text = data.repeat_text
        announcement.scroll_speed = data.scroll_speed
        
        db.commit()
        db.refresh(announcement)
        return announcement
    except Exception as e:
        print(f"Error in update_announcement: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    content = await file.read()
    content_type = file.content_type or "image/jpeg"
    
    stored_image = models.StoredImage(
        filename=file.filename or f"{uuid.uuid4()}.jpg",
        content_type=content_type,
        data=content
    )
    db.add(stored_image)
    db.commit()
    db.refresh(stored_image)
    
    return {"url": f"/api/images/{stored_image.id}"}

@router.get("", response_model=List[schemas.ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@router.get("/{slug}", response_model=schemas.ProductResponse)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("", response_model=schemas.ProductResponse)
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
