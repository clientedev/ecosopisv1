from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin

router = APIRouter()

# Config Management
@router.put("/config", response_model=schemas.RouletteConfigResponse)
def update_roulette_config(
    config_in: schemas.RouletteConfigUpdate, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(get_current_admin)
):
    config = db.query(models.RouletteConfig).first()
    if not config:
        config = models.RouletteConfig()
        db.add(config)
    
    update_data = config_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    
    db.commit()
    db.refresh(config)
    return config

# Prize Management (CRUD)
@router.get("/prizes", response_model=List[schemas.RoulettePrizeResponse])
def list_prizes(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    return db.query(models.RoulettePrize).all()

@router.post("/prizes", response_model=schemas.RoulettePrizeResponse)
def create_prize(
    prize_in: schemas.RoulettePrizeCreate, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(get_current_admin)
):
    db_prize = models.RoulettePrize(**prize_in.dict())
    db.add(db_prize)
    db.commit()
    db.refresh(db_prize)
    return db_prize

@router.put("/prizes/{prize_id}", response_model=schemas.RoulettePrizeResponse)
def update_prize(
    prize_id: int, 
    prize_in: schemas.RoulettePrizeUpdate, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(get_current_admin)
):
    db_prize = db.query(models.RoulettePrize).filter(models.RoulettePrize.id == prize_id).first()
    if not db_prize:
        raise HTTPException(status_code=404, detail="Prêmio não encontrado")
    
    update_data = prize_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_prize, key, value)
    
    db.commit()
    db.refresh(db_prize)
    return db_prize

@router.delete("/prizes/{prize_id}")
def delete_prize(prize_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_prize = db.query(models.RoulettePrize).filter(models.RoulettePrize.id == prize_id).first()
    if not db_prize:
        raise HTTPException(status_code=404, detail="Prêmio não encontrado")
    db.delete(db_prize)
    db.commit()
    return {"message": "Prêmio removido com sucesso"}

# User Management
@router.put("/usuarios/{user_id}/liberar-roleta")
def manual_release_roulette(
    user_id: int, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(get_current_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user.pode_girar_roleta = True
    db.commit()
    return {"message": f"Giro liberado para o usuário {user.email}"}

@router.get("/history", response_model=List[schemas.RouletteHistoryResponse])
def get_roulette_history(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    return db.query(models.RouletteHistory).all()
