from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from app.api.endpoints.scratchcard import _get_or_create_settings

router = APIRouter()

@router.get("/config", response_model=schemas.ScratchSettingsResponse)
def get_admin_scratch_config(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """Obtém as configurações administrativas da raspadinha."""
    return _get_or_create_settings(db)

@router.put("/config", response_model=schemas.ScratchSettingsResponse)
def update_admin_scratch_config(
    config_in: schemas.ScratchSettingsUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """Atualiza as configurações da raspadinha (Ativar/Desativar, Tipo de prêmio, Valor, Prefixo, Expiração e Mensagem)."""
    config = _get_or_create_settings(db)
    
    update_data = config_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(config, field, value)
            
    db.commit()
    db.refresh(config)
    return config

@router.get("/history", response_model=List[schemas.ScratchRewardResponse])
def get_scratch_history(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """Retorna o histórico dos prêmios de raspadinha resgatados pelos usuários."""
    return db.query(models.ScratchReward).order_by(models.ScratchReward.created_at.desc()).all()
