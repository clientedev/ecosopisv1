from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin

router = APIRouter()

@router.get("", response_model=List[schemas.RawMaterialResponse])
def list_raw_materials(db: Session = Depends(get_db)):
    return db.query(models.RawMaterial).order_by(models.RawMaterial.name).all()

@router.post("", response_model=schemas.RawMaterialResponse)
def create_raw_material(
    name: str,
    description: str = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    existing = db.query(models.RawMaterial).filter(models.RawMaterial.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Raw material already exists")
    rm = models.RawMaterial(name=name, description=description)
    db.add(rm)
    db.commit()
    db.refresh(rm)
    return rm

@router.delete("/{rm_id}")
def delete_raw_material(
    rm_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    rm = db.query(models.RawMaterial).filter(models.RawMaterial.id == rm_id).first()
    if not rm:
        raise HTTPException(status_code=404, detail="Raw material not found")
    db.delete(rm)
    db.commit()
    return {"message": "Deleted"}
