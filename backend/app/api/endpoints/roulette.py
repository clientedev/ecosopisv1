from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import random
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user

router = APIRouter()

@router.get("/config", response_model=schemas.RouletteConfigResponse)
def get_roulette_config(db: Session = Depends(get_db)):
    config = db.query(models.RouletteConfig).first()
    if not config:
        # Create default if not exists
        config = models.RouletteConfig(ativa=False, popup_ativo=False)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.get("/prizes", response_model=List[schemas.RoulettePrizeResponse])
def list_active_prizes(db: Session = Depends(get_db)):
    """Public endpoint to list prizes for visualization on the wheel."""
    print("DEBUG: Fetching roulette prizes for UI visualization")
    return db.query(models.RoulettePrize).filter(
        models.RoulettePrize.ativo == True
    ).all()

@router.post("/girar", response_model=schemas.RouletteSpinResponse)
def spin_roulette(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Check if roulette is active
    config = db.query(models.RouletteConfig).first()
    if not config or not config.ativa:
        raise HTTPException(status_code=400, detail="A roleta não está ativa no momento.")

    # 2. Check if user can spin
    if not current_user.pode_girar_roleta:
        raise HTTPException(status_code=403, detail="Você não tem giros disponíveis.")

    # 3. Get eligible prizes
    prizes = db.query(models.RoulettePrize).filter(
        models.RoulettePrize.ativo == True,
        models.RoulettePrize.selecionado_para_sair == True
    ).all()

    if not prizes:
        raise HTTPException(status_code=404, detail="Não há prêmios disponíveis no momento.")

    # 4. Choose a prize
    chosen_prize = random.choice(prizes)

    # 5. Stock control (optional)
    if chosen_prize.quantidade_disponivel is not None:
        if chosen_prize.quantidade_disponivel <= 0:
            # Fallback or error if stock is out but it was selected to drop
            raise HTTPException(status_code=400, detail="Prêmio esgotado. Tente novamente mais tarde.")
        chosen_prize.quantidade_disponivel -= 1

    # 6. Record history and update user
    history = models.RouletteHistory(
        usuario_id=current_user.id,
        premio_id=chosen_prize.id
    )
    db.add(history)
    
    current_user.pode_girar_roleta = False
    current_user.tentativas_roleta += 1
    current_user.ultimo_premio_id = chosen_prize.id
    
    db.commit()
    db.refresh(chosen_prize)

    return {"prize": chosen_prize}
