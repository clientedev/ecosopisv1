from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin

router = APIRouter()

@router.get("/", response_model=List[schemas.CarouselItemResponse])
def list_carousel_items(db: Session = Depends(get_db)):
    return db.query(models.CarouselItem).filter(models.CarouselItem.is_active == True).order_by(models.CarouselItem.order).all()

@router.post("/", response_model=schemas.CarouselItemResponse)
def create_carousel_item(
    item_in: schemas.CarouselItemCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_item = models.CarouselItem(**item_in.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{item_id}", response_model=schemas.CarouselItemResponse)
def update_carousel_item(
    item_id: int,
    item_in: schemas.CarouselItemCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_item = db.query(models.CarouselItem).filter(models.CarouselItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = item_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
    
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
