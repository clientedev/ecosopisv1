from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.endpoints.auth import get_current_user
from app.models import models
from app.schemas import schemas

router = APIRouter()

@router.get("/me", response_model=List[schemas.AddressResponse])
def get_my_addresses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Address).filter(models.Address.user_id == current_user.id).all()

@router.post("/me", response_model=schemas.AddressResponse)
def add_address(
    address_in: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # If this is the first address, or if is_default is true, unset other defaults
    if address_in.is_default:
        db.query(models.Address).filter(
            models.Address.user_id == current_user.id,
            models.Address.is_default == True
        ).update({"is_default": False})

    # If first address, make it default regardless
    address_count = db.query(models.Address).filter(models.Address.user_id == current_user.id).count()
    is_default = address_in.is_default or address_count == 0

    new_address = models.Address(
        **address_in.dict(exclude={"is_default"}),
        user_id=current_user.id,
        is_default=is_default
    )
    db.add(new_address)
    db.commit()
    db.refresh(new_address)
    return new_address

@router.put("/me/{address_id}/default", response_model=schemas.AddressResponse)
def set_default_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    address = db.query(models.Address).filter(
        models.Address.id == address_id,
        models.Address.user_id == current_user.id
    ).first()
    
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    # Unset all other defaults
    db.query(models.Address).filter(
        models.Address.user_id == current_user.id,
        models.Address.is_default == True
    ).update({"is_default": False})

    address.is_default = True
    db.commit()
    db.refresh(address)
    return address

@router.delete("/me/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    address = db.query(models.Address).filter(
        models.Address.id == address_id,
        models.Address.user_id == current_user.id
    ).first()
    
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    was_default = address.is_default
    db.delete(address)
    db.commit()

    # If we deleted the default address, make another one default if available
    if was_default:
        new_default = db.query(models.Address).filter(
            models.Address.user_id == current_user.id
        ).first()
        if new_default:
            new_default.is_default = True
            db.commit()

    return None
