from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
import shutil
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[schemas.CarouselItemResponse])
def list_carousel_items(db: Session = Depends(get_db)):
    return db.query(models.CarouselItem).filter(models.CarouselItem.is_active == True).order_by(models.CarouselItem.order).all()

@router.post("/", response_model=schemas.CarouselItemResponse)
def create_carousel_item(
    badge: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    order: int = Form(0),
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    cta_primary_text: Optional[str] = Form(None),
    cta_primary_link: Optional[str] = Form(None),
    cta_secondary_text: Optional[str] = Form(None),
    cta_secondary_link: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    final_image_url = image_url
    if file and file.filename:
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        final_image_url = f"/static/uploads/{file_name}"

    db_item = models.CarouselItem(
        badge=badge,
        title=title,
        description=description,
        image_url=final_image_url,
        cta_primary_text=cta_primary_text,
        cta_primary_link=cta_primary_link,
        cta_secondary_text=cta_secondary_text,
        cta_secondary_link=cta_secondary_link,
        order=order
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{item_id}", response_model=schemas.CarouselItemResponse)
def update_carousel_item(
    item_id: int,
    badge: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    order: int = Form(0),
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    cta_primary_text: Optional[str] = Form(None),
    cta_primary_link: Optional[str] = Form(None),
    cta_secondary_text: Optional[str] = Form(None),
    cta_secondary_link: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_item = db.query(models.CarouselItem).filter(models.CarouselItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    final_image_url = image_url or db_item.image_url
    if file and file.filename:
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        final_image_url = f"/static/uploads/{file_name}"

    db_item.badge = str(badge) if badge is not None else None
    db_item.title = str(title) if title is not None else None
    db_item.description = str(description) if description is not None else None
    db_item.image_url = str(final_image_url) if final_image_url is not None else None
    db_item.cta_primary_text = str(cta_primary_text) if cta_primary_text is not None else None
    db_item.cta_primary_link = str(cta_primary_link) if cta_primary_link is not None else None
    db_item.cta_secondary_text = str(cta_secondary_text) if cta_secondary_text is not None else None
    db_item.cta_secondary_link = str(cta_secondary_link) if cta_secondary_link is not None else None
    db_item.order = int(order)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{item_id}")
def delete_carousel_item(
    item_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_item = db.query(models.CarouselItem).filter(models.CarouselItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Item deleted"}
