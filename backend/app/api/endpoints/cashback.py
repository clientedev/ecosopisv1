"""
Cashback system endpoints — user area + admin management
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.endpoints.auth import get_current_user
from app.models.models import User, CashbackConfig, CashbackTransaction, Order

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_config(db: Session) -> CashbackConfig:
    cfg = db.query(CashbackConfig).first()
    if not cfg:
        cfg = CashbackConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _expire_old_transactions(db: Session, user_id: int):
    """Marca como 'expired' transações aprovadas cuja validade venceu."""
    now = datetime.now(timezone.utc)
    db.query(CashbackTransaction).filter(
        CashbackTransaction.user_id == user_id,
        CashbackTransaction.status == "approved",
        CashbackTransaction.expires_at != None,
        CashbackTransaction.expires_at < now,
    ).update({"status": "expired"})
    db.commit()


def _available_balance(db: Session, user_id: int) -> float:
    _expire_old_transactions(db, user_id)
    earned = db.query(CashbackTransaction).filter(
        CashbackTransaction.user_id == user_id,
        CashbackTransaction.type == "earned",
        CashbackTransaction.status == "approved",
    ).all()
    used = db.query(CashbackTransaction).filter(
        CashbackTransaction.user_id == user_id,
        CashbackTransaction.type == "used",
        CashbackTransaction.status == "used",
    ).all()
    total_earned = sum(t.amount for t in earned)
    total_used = sum(t.amount for t in used)
    return round(max(0.0, total_earned - total_used), 2)


def create_cashback_for_order(db: Session, order: Order, user: User):
    """
    Gera o cashback para um pedido pago.
    Chamado pelo webhook de pagamento.
    """
    cfg = _get_config(db)
    if not cfg.is_active:
        return

    # Verifica valor mínimo de compra para ganhar
    if (cfg.min_purchase_to_earn or 0) > 0 and order.total < cfg.min_purchase_to_earn:
        logger.info(f"[Cashback] Pedido {order.id} abaixo do mínimo para ganhar cashback.")
        return

    # Verifica se é primeira compra
    paid_orders_count = db.query(Order).filter(
        Order.user_id == user.id,
        Order.status.in_(["paid", "shipped", "delivered"]),
        Order.id != order.id,
    ).count()
    is_first = paid_orders_count == 0

    # Calcula percentual e validade
    if is_first:
        pct = cfg.first_purchase_percentage / 100.0
        validity_days = cfg.first_purchase_validity_days
        desc = f"🎉 Cashback na primeira compra — Pedido #{order.id}"
    else:
        pct = cfg.repurchase_percentage / 100.0
        validity_days = cfg.repurchase_validity_days
        desc = f"💰 Cashback na recompra — Pedido #{order.id}"

    amount = round(order.total * pct, 2)
    if amount <= 0:
        return

    expires_at = datetime.now(timezone.utc) + timedelta(days=validity_days)

    tx = CashbackTransaction(
        user_id=user.id,
        order_id=order.id,
        amount=amount,
        type="earned",
        status="approved",
        description=desc,
        is_first_purchase=is_first,
        expires_at=expires_at,
    )
    db.add(tx)
    db.commit()
    logger.info(f"[Cashback] R${amount:.2f} gerado para user {user.id} (pedido {order.id}) — expira {expires_at.date()}")


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class CashbackBalanceOut(BaseModel):
    available_balance: float
    pending_balance: float
    next_expiration_date: Optional[str]
    next_expiration_amount: float

class CashbackTxOut(BaseModel):
    id: int
    order_id: Optional[int]
    amount: float
    type: str
    status: str
    description: Optional[str]
    is_first_purchase: bool
    expires_at: Optional[str]
    created_at: str

class UseCashbackIn(BaseModel):
    amount: float   # valor a usar

class CashbackConfigOut(BaseModel):
    id: int
    is_active: bool
    first_purchase_percentage: float
    repurchase_percentage: float
    first_purchase_validity_days: int
    repurchase_validity_days: int
    min_purchase_to_earn: float
    min_purchase_to_use: float
    allow_with_coupons: bool

class CashbackConfigUpdateIn(BaseModel):
    is_active: Optional[bool] = None
    first_purchase_percentage: Optional[float] = None
    repurchase_percentage: Optional[float] = None
    first_purchase_validity_days: Optional[int] = None
    repurchase_validity_days: Optional[int] = None
    min_purchase_to_earn: Optional[float] = None
    min_purchase_to_use: Optional[float] = None
    allow_with_coupons: Optional[bool] = None


# ── User Endpoints ────────────────────────────────────────────────────────────

@router.get("/cashback/me/balance", response_model=CashbackBalanceOut)
def get_my_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna saldo disponível e pendente de cashback do usuário."""
    _expire_old_transactions(db, current_user.id)

    approved = db.query(CashbackTransaction).filter(
        CashbackTransaction.user_id == current_user.id,
        CashbackTransaction.type == "earned",
        CashbackTransaction.status == "approved",
    ).all()
    used = db.query(CashbackTransaction).filter(
        CashbackTransaction.user_id == current_user.id,
        CashbackTransaction.type == "used",
        CashbackTransaction.status == "used",
    ).all()

    total_earned = sum(t.amount for t in approved)
    total_used = sum(t.amount for t in used)
    available = round(max(0, total_earned - total_used), 2)

    # Próximo vencimento
    next_exp = None
    next_exp_amount = 0.0
    now = datetime.now(timezone.utc)
    upcoming = sorted(
        [t for t in approved if t.expires_at and t.expires_at > now],
        key=lambda t: t.expires_at
    )
    if upcoming:
        next_exp = upcoming[0].expires_at.strftime("%d/%m/%Y")
        next_exp_amount = round(upcoming[0].amount, 2)

    return CashbackBalanceOut(
        available_balance=available,
        pending_balance=0.0,
        next_expiration_date=next_exp,
        next_expiration_amount=next_exp_amount,
    )


@router.get("/cashback/me/history", response_model=List[CashbackTxOut])
def get_my_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Histórico completo de cashback do usuário."""
    _expire_old_transactions(db, current_user.id)
    txs = (
        db.query(CashbackTransaction)
        .filter(CashbackTransaction.user_id == current_user.id)
        .order_by(CashbackTransaction.created_at.desc())
        .all()
    )
    return [
        CashbackTxOut(
            id=t.id,
            order_id=t.order_id,
            amount=t.amount,
            type=t.type,
            status=t.status,
            description=t.description,
            is_first_purchase=bool(t.is_first_purchase),
            expires_at=t.expires_at.strftime("%d/%m/%Y") if t.expires_at else None,
            created_at=t.created_at.strftime("%d/%m/%Y %H:%M") if t.created_at else "",
        )
        for t in txs
    ]


@router.post("/cashback/me/validate-use")
def validate_cashback_use(
    body: UseCashbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Valida se o usuário pode usar determinado valor de cashback."""
    cfg = _get_config(db)
    if not cfg.is_active:
        raise HTTPException(400, "Sistema de cashback desativado.")
    balance = _available_balance(db, current_user.id)
    if body.amount > balance:
        raise HTTPException(400, f"Saldo insuficiente. Disponível: R${balance:.2f}.")
    if body.amount <= 0:
        raise HTTPException(400, "Valor inválido.")
    return {"valid": True, "available_balance": balance, "amount": body.amount}


# ── Admin Endpoints ───────────────────────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Acesso restrito a administradores.")
    return current_user


@router.get("/cashback/admin/config", response_model=CashbackConfigOut)
def admin_get_config(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return _get_config(db)


@router.put("/cashback/admin/config", response_model=CashbackConfigOut)
def admin_update_config(
    body: CashbackConfigUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    cfg = _get_config(db)
    for field, val in body.dict(exclude_none=True).items():
        setattr(cfg, field, val)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.get("/cashback/admin/transactions")
def admin_get_transactions(
    status_filter: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    q = db.query(CashbackTransaction)
    if status_filter:
        q = q.filter(CashbackTransaction.status == status_filter)
    if user_id:
        q = q.filter(CashbackTransaction.user_id == user_id)
    total = q.count()
    txs = q.order_by(CashbackTransaction.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for t in txs:
        user = db.query(User).filter(User.id == t.user_id).first()
        result.append({
            "id": t.id,
            "user_id": t.user_id,
            "user_email": user.email if user else "",
            "user_name": user.full_name if user else "",
            "order_id": t.order_id,
            "amount": t.amount,
            "type": t.type,
            "status": t.status,
            "description": t.description,
            "is_first_purchase": t.is_first_purchase,
            "expires_at": t.expires_at.strftime("%d/%m/%Y") if t.expires_at else None,
            "created_at": t.created_at.strftime("%d/%m/%Y %H:%M") if t.created_at else "",
        })
    return {"total": total, "transactions": result}


@router.get("/cashback/admin/stats")
def admin_get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """Totais para o dashboard admin."""
    # Expirar automaticamente
    now = datetime.now(timezone.utc)
    db.query(CashbackTransaction).filter(
        CashbackTransaction.status == "approved",
        CashbackTransaction.expires_at != None,
        CashbackTransaction.expires_at < now,
    ).update({"status": "expired"})
    db.commit()

    all_earned = db.query(CashbackTransaction).filter(
        CashbackTransaction.type == "earned"
    ).all()
    all_used = db.query(CashbackTransaction).filter(
        CashbackTransaction.type == "used",
        CashbackTransaction.status == "used"
    ).all()

    total_emitido = sum(t.amount for t in all_earned if t.status != "reversed")
    total_usado = sum(t.amount for t in all_used)
    total_expirado = sum(t.amount for t in all_earned if t.status == "expired")
    em_circulacao = round(total_emitido - total_usado - total_expirado, 2)

    unique_users = len(set(t.user_id for t in all_earned))
    first_purchase_count = sum(1 for t in all_earned if t.is_first_purchase)

    return {
        "total_emitido": round(total_emitido, 2),
        "total_usado": round(total_usado, 2),
        "total_expirado": round(total_expirado, 2),
        "em_circulacao": max(0, em_circulacao),
        "usuarios_com_cashback": unique_users,
        "cashback_primeira_compra": first_purchase_count,
    }
