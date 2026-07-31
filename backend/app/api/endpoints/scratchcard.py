from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import random
import string

from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user

router = APIRouter()

def _get_or_create_settings(db: Session) -> models.ScratchSettings:
    config = db.query(models.ScratchSettings).first()
    if not config:
        config = models.ScratchSettings(
            enabled=True,
            reward_type="percentage",
            reward_value=10.0,
            coupon_prefix="BEMVINDO",
            coupon_valid_days=30,
            message="Parabéns! Você ganhou 10% de desconto."
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def _generate_coupon_code(prefix: str, length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=length))
    clean_prefix = (prefix or "BEMVINDO").strip().upper()
    return f"{clean_prefix}-{suffix}"

@router.get("/config", response_model=schemas.ScratchSettingsResponse)
def get_scratch_config(db: Session = Depends(get_db)):
    """Retorna as configurações públicas da raspadinha."""
    return _get_or_create_settings(db)

@router.get("/status")
def get_scratch_status(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Verifica se o usuário já usou a raspadinha e se ela está ativa."""
    config = _get_or_create_settings(db)
    return {
        "scratch_used": current_user.scratch_used,
        "enabled": config.enabled
    }

@router.post("/play", response_model=schemas.ScratchPlayResponse)
def play_scratchcard(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Executa a jogada da raspadinha para um usuário recém-cadastrado (uma única vez)."""
    config = _get_or_create_settings(db)
    
    if not config.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A Raspadinha de Boas-vindas está temporariamente desativada."
        )
    
    if current_user.scratch_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você já utilizou sua Raspadinha de Boas-vindas."
        )
    
    # Gerar código de cupom único
    code = _generate_coupon_code(config.coupon_prefix)
    while db.query(models.Coupon).filter(models.Coupon.code == code).first():
        code = _generate_coupon_code(config.coupon_prefix)

    expires_at = datetime.now(timezone.utc) + timedelta(days=config.coupon_valid_days)

    # 1. Salvar cupom na tabela oficial de cupons
    coupon = models.Coupon(
        code=code,
        discount_type=config.reward_type,
        discount_value=config.reward_value,
        min_purchase_value=0.0,
        valid_until=expires_at,
        is_active=True,
        usage_limit=1,
        usage_count=0
    )
    db.add(coupon)

    # 2. Registar histórico em scratch_rewards
    reward = models.ScratchReward(
        user_id=current_user.id,
        reward_type=config.reward_type,
        reward_value=config.reward_value,
        coupon_code=code,
        expires_at=expires_at,
        used=False
    )
    db.add(reward)
    db.flush()

    # 3. Atualizar usuário
    current_user.scratch_used = True
    current_user.scratch_reward_id = reward.id
    db.add(current_user)

    db.commit()

    return schemas.ScratchPlayResponse(
        reward_type=config.reward_type,
        reward_value=config.reward_value,
        coupon_code=code,
        expires_at=expires_at,
        message=config.message
    )
