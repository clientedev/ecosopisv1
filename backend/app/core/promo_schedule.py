"""
Promoções programadas (Black Friday 2026).

Sexta, 27/11/2026, de 00:00 a 23:59 (horário de Brasília):
  - 25% OFF em toda a loja, calculado sobre o preço cheio (substitui o desconto
    atual, não soma com ele);
  - exceto o Tônico Facial, que fica por R$ 7,99;
  - nenhum cupom vale durante a promoção (cupons não acumulam com ela);
  - atacado continua com a regra própria (45% sobre o preço cheio, a partir de
    10 itens) e não recebe a Black Friday por cima.

À 00:00 do sábado, 28/11, os preços voltam exatamente ao que eram antes
(guardados num snapshot em system_settings). Um produto que o admin tenha
alterado durante a promoção não é sobrescrito na volta.

O agendador roda dentro do backend (thread a cada 30 s), é idempotente e usa um
lock do Postgres, então reinícios ou deploys no meio do caminho não duplicam nada.
"""
from __future__ import annotations

import json
import logging
import threading
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.models import models

logger = logging.getLogger("promo_schedule")

BRT = timezone(timedelta(hours=-3))

BF_START = datetime(2026, 11, 27, 0, 0, 0, tzinfo=BRT)
BF_END = datetime(2026, 11, 28, 0, 0, 0, tzinfo=BRT)
BF_STORE_DISCOUNT = 0.25      # 25% OFF em toda a loja
BF_TONICO_PRICE = 7.99        # Tônico Facial por R$ 7,99

STATE_KEY = "promo_bf2026_state"        # "pending" | "applied" | "restored"
SNAPSHOT_KEY = "promo_bf2026_snapshot"  # preços anteriores + preços aplicados
ADVISORY_LOCK_ID = 2026112701

COUPON_BLOCK_MESSAGE = (
    "Cupons não são acumulativos com a Black Friday: os produtos já estão com o "
    "preço promocional."
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def is_bf_window(now: Optional[datetime] = None) -> bool:
    now = now or _now()
    return BF_START <= now < BF_END


def coupons_blocked(now: Optional[datetime] = None) -> bool:
    """Durante a Black Friday nenhum cupom vale (nem PRIMEIRACOMPRA, roleta ou frete grátis por cupom)."""
    return is_bf_window(now)


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return " ".join(s.replace("-", " ").split())


def is_tonico_facial(product: models.Product) -> bool:
    slug = _norm(product.slug or "")
    name = _norm(product.name or "")
    if "kit" in name.split() or "combo" in name.split():
        return False
    return slug.startswith("tonico facial") or name.startswith("tonico facial")


def bf_price_for(product: models.Product, base: float) -> float:
    if is_tonico_facial(product):
        return BF_TONICO_PRICE
    return max(0.01, round(base * (1.0 - BF_STORE_DISCOUNT), 2))


def _get_setting(db, key: str) -> Optional[models.SystemSetting]:
    return db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()


def _set_setting(db, key: str, value: str) -> None:
    row = _get_setting(db, key)
    if row is None:
        row = models.SystemSetting(key=key)
        db.add(row)
    row.value = value


def _lock(db) -> bool:
    if engine.dialect.name != "postgresql":
        return True
    return bool(db.execute(text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": ADVISORY_LOCK_ID}).scalar())


def _apply(db) -> int:
    products = db.query(models.Product).all()
    snapshot = {}
    applied = []
    for p in products:
        snapshot[str(p.id)] = {
            "price": p.price,
            "original_price": p.original_price,
            "is_on_sale": bool(p.is_on_sale),
            "sale_price": p.sale_price,
        }
        base = float(p.original_price if p.original_price is not None else (p.price or 0.0))
        if base <= 0:
            continue
        new_sale = bf_price_for(p, base)
        if new_sale >= base:
            continue
        if p.original_price is None:
            p.original_price = base
        p.price = base            # preço cheio continua sendo a base do atacado (45%)
        p.is_on_sale = True
        p.sale_price = new_sale
        applied.append({"id": p.id, "name": p.name, "base": base, "sale": new_sale})

    _set_setting(db, SNAPSHOT_KEY, json.dumps({
        "taken_at": _now().isoformat(),
        "before": snapshot,
        "applied": {str(a["id"]): a["sale"] for a in applied},
    }))
    _set_setting(db, STATE_KEY, "applied")
    tonicos = [a for a in applied if a["sale"] == BF_TONICO_PRICE]
    logger.info(f"[BF2026] Black Friday aplicada em {len(applied)} produtos; "
                f"tônico(s) a R$ 7,99: {[t['name'] for t in tonicos]}")
    return len(applied)


def _restore(db) -> int:
    row = _get_setting(db, SNAPSHOT_KEY)
    data = json.loads(row.value) if row and row.value else {}
    before = data.get("before", {})
    applied = data.get("applied", {})
    restored = 0
    for p in db.query(models.Product).all():
        key = str(p.id)
        if key not in before or key not in applied:
            continue
        # Só desfaz se o produto ainda está com o preço que a Black Friday colocou
        if not (p.is_on_sale and p.sale_price is not None and abs(float(p.sale_price) - float(applied[key])) < 0.005):
            continue
        prev = before[key]
        p.price = prev["price"]
        p.original_price = prev["original_price"]
        p.is_on_sale = prev["is_on_sale"]
        p.sale_price = prev["sale_price"]
        restored += 1
    _set_setting(db, STATE_KEY, "restored")
    logger.info(f"[BF2026] Black Friday encerrada: {restored} produtos voltaram ao preço anterior")
    return restored


def tick(now: Optional[datetime] = None) -> Optional[str]:
    """Aplica ou desfaz a promoção conforme o horário. Retorna a ação feita (ou None)."""
    now = now or _now()
    db = SessionLocal()
    try:
        if not _lock(db):
            return None
        state_row = _get_setting(db, STATE_KEY)
        state = (state_row.value if state_row else None) or "pending"
        action = None
        if state == "pending" and BF_START <= now < BF_END:
            _apply(db)
            action = "applied"
        elif state == "pending" and now >= BF_END:
            _set_setting(db, STATE_KEY, "restored")  # janela perdida: não aplica depois do fim
            action = "skipped"
        elif state == "applied" and now >= BF_END:
            _restore(db)
            action = "restored"
        db.commit()
        return action
    except Exception as e:
        db.rollback()
        logger.error(f"[BF2026] erro no agendador de promoção: {e}")
        return None
    finally:
        db.close()


_started = False


def start_scheduler(interval_seconds: int = 30) -> None:
    global _started
    if _started:
        return
    _started = True

    def _loop():
        while True:
            tick()
            time.sleep(interval_seconds)

    threading.Thread(target=_loop, name="promo-schedule", daemon=True).start()
    logger.info(f"[BF2026] agendador ativo: {BF_START.isoformat()} → {BF_END.isoformat()}")
