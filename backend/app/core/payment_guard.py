"""
Proteções centrais do fluxo de compra.

1. payment_matches_order  → um pagamento do Mercado Pago só quita um pedido se for
   DESTE pedido (external_reference) e cobrir o valor devido.
2. can_access_order       → dono do pedido, admin ou portador do guest_access_token.
3. verify_shipping_price  → o frete cobrado nunca fica abaixo da cotação real
   (Melhor Envio) ou da tabela de contingência que o site exibe ao cliente.
"""
import hmac
import logging
import threading
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)

APPROVED_STATUSES = ("approved", "authorized")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Pagamento ↔ pedido
# ─────────────────────────────────────────────────────────────────────────────

def amount_tolerance(order_total: float, items: Optional[Iterable[dict]] = None) -> float:
    """
    Tolerância de centavos para arredondamentos do Mercado Pago (o Checkout Pro
    distribui o desconto por item e arredonda cada linha).
    """
    qty = 0
    for it in items or []:
        try:
            qty += int((it or {}).get("quantity") or 1)
        except (TypeError, ValueError):
            qty += 1
    return round(0.05 + 0.01 * max(qty, 1), 2)


def payment_matches_order(
    payment_info: Dict[str, Any],
    order: Any,
    expected_amount: Optional[float] = None,
) -> Tuple[bool, str]:
    """
    True somente se:
      - o pagamento está aprovado;
      - external_reference é o ID deste pedido (pagamentos criados pelo site
        sempre levam o ID do pedido como external_reference);
      - o valor pago cobre o valor esperado (total do pedido, ou o valor da
        parcela no pagamento combinado).
    """
    if not payment_info:
        return False, "pagamento não encontrado"
    status = str(payment_info.get("status") or "").lower()
    if status not in APPROVED_STATUSES:
        return False, f"status {status or 'desconhecido'}"

    ext_ref = str(payment_info.get("external_reference") or "").strip()
    if ext_ref != str(order.id):
        return False, f"external_reference '{ext_ref}' não pertence ao pedido #{order.id}"

    try:
        paid = round(float(payment_info.get("transaction_amount") or 0.0), 2)
    except (TypeError, ValueError):
        paid = 0.0
    due = round(float(expected_amount if expected_amount is not None else (order.total or 0.0)), 2)
    tol = amount_tolerance(due, getattr(order, "items", None))
    if paid + tol < due:
        return False, f"valor pago R$ {paid:.2f} menor que o devido R$ {due:.2f}"

    currency = payment_info.get("currency_id")
    if currency and str(currency).upper() != "BRL":
        return False, f"moeda {currency} inválida"

    return True, "ok"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Acesso ao pedido
# ─────────────────────────────────────────────────────────────────────────────

def can_access_order(order: Any, current_user: Any = None, guest_token: Optional[str] = None) -> bool:
    if current_user is not None:
        if getattr(current_user, "role", None) == "admin":
            return True
        if order.user_id and order.user_id == current_user.id:
            return True
    order_token = getattr(order, "guest_access_token", None)
    if guest_token and order_token and hmac.compare_digest(str(guest_token), str(order_token)):
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# 3. Frete
# ─────────────────────────────────────────────────────────────────────────────

# Mesmas faixas do carrinho (frontend/src/app/carrinho/page.tsx)
FREE_SHIPPING_SOUTH_SOUTHEAST = 148.90
FREE_SHIPPING_OTHER_REGIONS = 248.90


def _cep_prefix(cep: str) -> Optional[int]:
    digits = "".join(filter(str.isdigit, str(cep or "")))
    if len(digits) != 8:
        return None
    return int(digits[:2])


def free_shipping_threshold(cep: str) -> Optional[float]:
    prefix = _cep_prefix(cep)
    if prefix is None:
        return None
    if 1 <= prefix <= 39 or 80 <= prefix <= 99:
        return FREE_SHIPPING_SOUTH_SOUTHEAST
    return FREE_SHIPPING_OTHER_REGIONS


def fallback_shipping_options(cep: str) -> List[dict]:
    """Tabela de contingência idêntica à do site (route.ts e shipping.py)."""
    prefix = _cep_prefix(cep) or 1
    is_sp = 1 <= prefix <= 19
    is_sse = (1 <= prefix <= 39) or (80 <= prefix <= 99)
    pick = lambda sp, sse, other: sp if is_sp else (sse if is_sse else other)  # noqa: E731
    return [
        {"id": 31, "name": "Express", "company": "Loggi", "price": pick(9.85, 15.90, 24.90)},
        {"id": 34, "name": "Loggi Ponto", "company": "Loggi", "price": pick(10.47, 16.50, 25.50)},
        {"id": 33, "name": "Standard", "company": "JeT", "price": pick(14.90, 19.90, 28.90)},
        {"id": 1, "name": "PAC", "company": "Correios", "price": pick(16.90, 22.90, 31.90)},
        {"id": 2, "name": "SEDEX", "company": "Correios", "price": pick(21.90, 32.90, 48.90)},
    ]


# Cache das cotações reais feitas pelo cliente em /shipping/calculate (30 min),
# para validar o checkout sem uma nova chamada lenta à Melhor Envio.
_QUOTE_TTL = 30 * 60
_quote_cache: Dict[Tuple, Tuple[float, List[dict]]] = {}
_quote_lock = threading.Lock()


def _quote_key(cep: str, items: Iterable[dict]) -> Tuple:
    digits = "".join(filter(str.isdigit, str(cep or "")))
    norm = []
    for it in items or []:
        pid = str((it or {}).get("product_id") or (it or {}).get("id") or "")
        try:
            qty = int((it or {}).get("quantity") or 1)
        except (TypeError, ValueError):
            qty = 1
        norm.append((pid, qty))
    return (digits, tuple(sorted(norm)))


def remember_quote(cep: str, items: Iterable[dict], options: List[dict]) -> None:
    if not options:
        return
    with _quote_lock:
        now = time.time()
        _quote_cache[_quote_key(cep, items)] = (now, list(options))
        if len(_quote_cache) > 5000:
            for k in [k for k, (ts, _) in _quote_cache.items() if now - ts > _QUOTE_TTL]:
                _quote_cache.pop(k, None)


def _cached_quote(cep: str, items: Iterable[dict]) -> Optional[List[dict]]:
    with _quote_lock:
        hit = _quote_cache.get(_quote_key(cep, items))
    if hit and time.time() - hit[0] <= _QUOTE_TTL:
        return hit[1]
    return None


def _live_quote(cep: str, items: List[dict]) -> List[dict]:
    try:
        from app.core.melhorenvio_service import MelhorEnvioService
        options, _err = MelhorEnvioService.calculate_shipping(cep, items, timeout=8, attempts=1)
        if options:
            remember_quote(cep, items, options)
        return options or []
    except Exception as exc:  # pragma: no cover - rede
        logger.warning(f"[Frete] Cotação ao vivo indisponível: {exc}")
        return []


def verify_shipping_price(
    cep: str,
    items: List[dict],
    subtotal: float,
    client_price: float,
    service_id: Optional[int],
    free_shipping_coupon: bool = False,
) -> Tuple[bool, float, str]:
    """
    Retorna (ok, preço_final, motivo).
    - Frete grátis só com cupom de frete grátis ou subtotal acima da faixa da região
      (e, como no carrinho, apenas para a opção mais barata).
    - Frete pago: nunca abaixo da cotação real nem da tabela de contingência
      exibida ao cliente (pequena tolerância para diferença de seguro/arredondamento).
    """
    client_price = max(0.0, round(float(client_price or 0.0), 2))
    if free_shipping_coupon:
        return True, 0.0, "cupom de frete grátis"

    threshold = free_shipping_threshold(cep)
    if threshold is None:
        return False, client_price, "CEP de entrega inválido."

    real = _cached_quote(cep, items)
    if real is None:
        real = _live_quote(cep, items)
    fallback = fallback_shipping_options(cep)

    def price_for(options: List[dict], sid: Optional[int]) -> Optional[float]:
        for o in options:
            try:
                if sid is not None and int(o.get("id")) == int(sid):
                    return round(float(o.get("price") or 0.0), 2)
            except (TypeError, ValueError):
                continue
        return None

    def cheapest(options: List[dict]) -> Optional[dict]:
        valid = [o for o in options if o.get("price") is not None]
        return min(valid, key=lambda o: float(o["price"])) if valid else None

    if client_price <= 0.0:
        if subtotal + 0.009 < threshold:
            return False, client_price, (
                f"Frete grátis disponível apenas para compras a partir de R$ {threshold:.2f} "
                "para a sua região. Recalcule o frete e tente novamente."
            )
        # Grátis só para a opção mais barata (mesma regra do carrinho)
        allowed_ids = set()
        for opts in (real, fallback):
            c = cheapest(opts)
            if c is not None:
                allowed_ids.add(int(c["id"]))
        if service_id is not None and allowed_ids and int(service_id) not in allowed_ids:
            return False, client_price, (
                "O frete grátis vale apenas para a opção de entrega mais econômica. "
                "Selecione essa opção ou recalcule o frete."
            )
        return True, 0.0, "frete grátis por valor de compra"

    candidates = [p for p in (price_for(real, service_id), price_for(fallback, service_id)) if p is not None]
    if not candidates:
        # Serviço desconhecido: exige pelo menos a opção mais barata conhecida
        known = [o for o in (real + fallback) if o.get("price")]
        if not known:
            return True, client_price, "sem cotação disponível"
        candidates = [min(float(o["price"]) for o in known)]

    minimum = min(candidates)
    tolerance = max(0.50, round(minimum * 0.05, 2))
    if client_price + tolerance < minimum:
        return False, client_price, (
            "O valor do frete mudou. Recalcule o frete no carrinho e tente novamente."
        )
    return True, client_price, "ok"
