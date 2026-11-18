"""
Integração Meta (Facebook / Instagram): Pixel + API de Conversões (CAPI) + Marketing API.

- O navegador dispara o Pixel (fbq) e, em paralelo, chama POST /api/meta/track.
  O backend repassa o mesmo evento para a CAPI com o MESMO event_id, então a
  Meta deduplica e fica com o sinal mais completo (browser + servidor).
- A compra (Purchase) é enviada pelo servidor quando o pagamento é aprovado
  (finalize_order_on_payment), com event_id = "purchase_<order_id>" — o mesmo
  usado pelo navegador na página do pedido.

Configuração (prioridade: tabela system_settings > variáveis de ambiente):
  meta_pixel_id      / META_PIXEL_ID       (padrão: 951267150021255)
  meta_capi_token    / META_CAPI_TOKEN     (token da API de Conversões)
  meta_test_event_code / META_TEST_EVENT_CODE (opcional, p/ aba "Testar eventos")
  meta_ads_token     / META_ADS_TOKEN      (token com ads_read p/ gasto/ROAS)
  meta_ad_account_id / META_AD_ACCOUNT_ID  (padrão: 1116883899402382)
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from contextvars import ContextVar
from typing import Any, Dict, List, Optional
from urllib.parse import unquote

import httpx

logger = logging.getLogger(__name__)

GRAPH_VERSION = "v21.0"
DEFAULT_PIXEL_ID = "951267150021255"
DEFAULT_AD_ACCOUNT_ID = "1116883899402382"
SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://www.ecosopis.com.br")

# Fontes consideradas "tráfego Meta" para atribuição no CRM
META_SOURCES = {"facebook", "instagram", "meta", "fb", "ig", "facebook_ads", "instagram_ads", "an", "msg", "threads"}

# ── Contexto da requisição (preenchido por middleware no main.py) ─────────────
_request_ctx: ContextVar[Dict[str, Any]] = ContextVar("meta_request_ctx", default={})


def capture_request_context(headers: Dict[str, str], cookies: Dict[str, str], client_host: Optional[str]) -> None:
    """Guarda cookies _fbp/_fbc/eco_attr, IP real e user-agent da requisição atual."""
    fwd = headers.get("x-forwarded-for") or headers.get("x-real-ip") or ""
    ip = fwd.split(",")[0].strip() if fwd else (client_host or "")
    # O proxy do Next repassa o IP do visitante neste header (ver frontend/src/middleware.ts)
    ip = headers.get("x-eco-client-ip") or ip
    ua = headers.get("x-eco-client-ua") or headers.get("user-agent") or ""
    _request_ctx.set({
        "fbp": cookies.get("_fbp"),
        "fbc": cookies.get("_fbc"),
        "attr": _parse_attr_cookie(cookies.get("eco_attr")),
        "ip": ip,
        "ua": ua,
    })


def get_request_context() -> Dict[str, Any]:
    return _request_ctx.get() or {}


def _parse_attr_cookie(raw: Optional[str]) -> Dict[str, str]:
    if not raw:
        return {}
    try:
        data = json.loads(unquote(raw))
        if isinstance(data, dict):
            return {k: str(v)[:200] for k, v in data.items() if v}
    except Exception:
        pass
    return {}


def is_meta_source(utm_source: Optional[str], fbc: Optional[str] = None) -> bool:
    if utm_source and utm_source.strip().lower() in META_SOURCES:
        return True
    return bool(fbc)


# ── Configuração ──────────────────────────────────────────────────────────────
_cfg_cache: Dict[str, Any] = {"ts": 0.0, "data": {}}


def get_config(db=None, force: bool = False) -> Dict[str, str]:
    now = time.time()
    if not force and now - _cfg_cache["ts"] < 60 and _cfg_cache["data"]:
        return _cfg_cache["data"]
    stored: Dict[str, str] = {}
    close = False
    try:
        if db is None:
            from app.core.database import SessionLocal
            db = SessionLocal()
            close = True
        from app.models import models
        rows = db.query(models.SystemSetting).filter(models.SystemSetting.key.like("meta_%")).all()
        stored = {r.key: (r.value or "").strip() for r in rows}
    except Exception as e:
        logger.debug(f"[Meta] não foi possível ler system_settings: {e}")
    finally:
        if close:
            try:
                db.close()
            except Exception:
                pass

    def pick(key: str, env: str, default: str = "") -> str:
        return stored.get(key) or os.getenv(env, "") or default

    data = {
        "pixel_id": pick("meta_pixel_id", "META_PIXEL_ID", DEFAULT_PIXEL_ID),
        "capi_token": pick("meta_capi_token", "META_CAPI_TOKEN"),
        "test_event_code": pick("meta_test_event_code", "META_TEST_EVENT_CODE"),
        "ads_token": pick("meta_ads_token", "META_ADS_TOKEN") or pick("meta_capi_token", "META_CAPI_TOKEN"),
        "ad_account_id": pick("meta_ad_account_id", "META_AD_ACCOUNT_ID", DEFAULT_AD_ACCOUNT_ID).replace("act_", ""),
    }
    _cfg_cache.update(ts=now, data=data)
    return data


def invalidate_config_cache() -> None:
    _cfg_cache.update(ts=0.0, data={})


# ── Normalização + hash (exigido pela Meta) ───────────────────────────────────
def _sha256(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip().lower()
    if not v:
        return None
    return hashlib.sha256(v.encode("utf-8")).hexdigest()


def _norm_phone(phone: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return None
    if len(digits) in (10, 11):  # DDD + número, sem país
        digits = "55" + digits
    return digits


def _norm_text(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    import unicodedata
    v = unicodedata.normalize("NFKD", str(v)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", v.lower()) or None


def build_user_data(
    email: Optional[str] = None,
    phone: Optional[str] = None,
    full_name: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    external_id: Optional[str] = None,
    fbp: Optional[str] = None,
    fbc: Optional[str] = None,
    ip: Optional[str] = None,
    ua: Optional[str] = None,
) -> Dict[str, Any]:
    first = last = None
    if full_name:
        parts = str(full_name).strip().split()
        if parts:
            first = parts[0]
            last = parts[-1] if len(parts) > 1 else None
    ud: Dict[str, Any] = {
        "em": _sha256(email),
        "ph": _sha256(_norm_phone(phone)),
        "fn": _sha256(_norm_text(first)),
        "ln": _sha256(_norm_text(last)),
        "ct": _sha256(_norm_text(city)),
        "st": _sha256(_norm_text(state)),
        "zp": _sha256(re.sub(r"\D", "", zip_code or "")[:5] or None),
        "country": _sha256("br"),
        "external_id": _sha256(external_id),
        "fbp": fbp or None,
        "fbc": fbc or None,
        "client_ip_address": ip or None,
        "client_user_agent": ua or None,
    }
    return {k: v for k, v in ud.items() if v}


# ── Envio para a CAPI ─────────────────────────────────────────────────────────
def send_events(events: List[Dict[str, Any]], db=None) -> Dict[str, Any]:
    """Envia eventos para a API de Conversões. Nunca levanta exceção."""
    cfg = get_config(db)
    if not cfg.get("capi_token") or not cfg.get("pixel_id"):
        return {"ok": False, "status": "skipped", "error": "Token da API de Conversões não configurado"}
    payload: Dict[str, Any] = {"data": events}
    if cfg.get("test_event_code"):
        payload["test_event_code"] = cfg["test_event_code"]
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{cfg['pixel_id']}/events"
    try:
        r = httpx.post(url, params={"access_token": cfg["capi_token"]}, json=payload, timeout=8.0)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text[:300]}
        if r.status_code == 200:
            return {"ok": True, "status": "sent", "response": body}
        err = (body.get("error") or {}).get("message") if isinstance(body, dict) else None
        logger.warning(f"[Meta CAPI] HTTP {r.status_code}: {err or body}")
        return {"ok": False, "status": "error", "error": err or f"HTTP {r.status_code}"}
    except Exception as e:
        logger.warning(f"[Meta CAPI] falha de rede: {e}")
        return {"ok": False, "status": "error", "error": str(e)[:300]}


def build_event(
    event_name: str,
    event_id: str,
    user_data: Dict[str, Any],
    custom_data: Optional[Dict[str, Any]] = None,
    event_source_url: Optional[str] = None,
    event_time: Optional[int] = None,
) -> Dict[str, Any]:
    ev: Dict[str, Any] = {
        "event_name": event_name,
        "event_time": int(event_time or time.time()),
        "event_id": event_id,
        "action_source": "website",
        "event_source_url": event_source_url or SITE_URL,
        "user_data": user_data,
    }
    if custom_data:
        ev["custom_data"] = {k: v for k, v in custom_data.items() if v is not None}
    return ev


def order_contents(order) -> List[Dict[str, Any]]:
    items = order.items or []
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        pid = it.get("product_id") or it.get("id")
        if pid is None:
            continue
        out.append({
            "id": str(pid),
            "quantity": int(it.get("quantity") or 1),
            "item_price": float(it.get("price") or 0),
        })
    return out


def send_purchase_for_order(order, db) -> Dict[str, Any]:
    """Envia o Purchase de um pedido pago (idempotente via meta_capi_sent_at)."""
    from datetime import datetime, timezone
    from app.models import models

    if getattr(order, "meta_capi_sent_at", None):
        return {"ok": True, "status": "already_sent"}

    addr = order.address or {}
    user = None
    if order.user_id:
        user = db.query(models.User).filter(models.User.id == order.user_id).first()
    email = order.buyer_email or order.customer_email or (user.email if user else None) or addr.get("email")
    phone = order.customer_phone or (user.phone if user else None) or addr.get("phone")
    name = order.customer_name or order.buyer_name or (user.full_name if user else None) or addr.get("name")
    ud = build_user_data(
        email=email, phone=phone, full_name=name,
        city=addr.get("city"), state=addr.get("state"),
        zip_code=addr.get("postal_code") or addr.get("cep") or addr.get("zip"),
        external_id=str(order.user_id) if order.user_id else email,
        fbp=order.meta_fbp, fbc=order.meta_fbc,
        ip=order.meta_client_ip, ua=order.meta_user_agent,
    )
    contents = order_contents(order)
    custom = {
        "currency": "BRL",
        "value": round(float(order.total or 0), 2),
        "content_type": "product",
        "content_ids": [c["id"] for c in contents],
        "contents": contents,
        "num_items": sum(c["quantity"] for c in contents) or None,
        "order_id": str(order.id),
    }
    event_id = f"purchase_{order.id}"
    # event_time = momento da confirmação do pagamento
    ev = build_event("Purchase", event_id, ud, custom, f"{SITE_URL}/pedido/{order.id}", int(time.time()))
    res = send_events([ev], db)

    try:
        is_meta = is_meta_source(order.utm_source, order.meta_fbc)
        db.add(models.MetaEvent(
            event_name="Purchase", event_id=event_id, source="server",
            path=f"/pedido/{order.id}", is_meta_traffic=is_meta,
            utm_source=order.utm_source, utm_medium=order.utm_medium,
            utm_campaign=order.utm_campaign, utm_content=order.utm_content,
            value=custom["value"], order_id=order.id, visitor_id=order.meta_fbp,
            capi_status=res.get("status"), capi_error=res.get("error"),
        ))
        if res.get("ok"):
            order.meta_capi_sent_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        logger.warning(f"[Meta] não foi possível registrar Purchase do pedido {order.id}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
    return res


def apply_attribution_to_order(order) -> None:
    """Copia cookies/UTM/IP/UA da requisição atual para o pedido (sem sobrescrever)."""
    ctx = get_request_context()
    if not ctx:
        return
    attr = ctx.get("attr") or {}
    for field, key in (("utm_source", "utm_source"), ("utm_medium", "utm_medium"),
                       ("utm_campaign", "utm_campaign"), ("utm_content", "utm_content")):
        if attr.get(key) and not getattr(order, field, None):
            setattr(order, field, attr[key][:200])
    if ctx.get("fbp") and not order.meta_fbp:
        order.meta_fbp = ctx["fbp"]
    if ctx.get("fbc") and not order.meta_fbc:
        order.meta_fbc = ctx["fbc"]
    if ctx.get("ip"):
        order.meta_client_ip = ctx["ip"][:64]
    if ctx.get("ua"):
        order.meta_user_agent = ctx["ua"][:500]


# ── Marketing API (gasto, alcance, ROAS) ──────────────────────────────────────
def fetch_ads_insights(since: str, until: str, db=None) -> Dict[str, Any]:
    cfg = get_config(db)
    token = cfg.get("ads_token")
    acct = cfg.get("ad_account_id")
    if not token or not acct:
        return {"available": False, "reason": "Token de anúncios não configurado"}
    base = f"https://graph.facebook.com/{GRAPH_VERSION}/act_{acct}/insights"
    fields = "campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,cpc,ctr,cpm,actions,action_values"
    time_range = json.dumps({"since": since, "until": until})
    try:
        r_total = httpx.get(base, params={"access_token": token, "fields": fields.replace("campaign_id,campaign_name,", ""),
                                          "time_range": time_range, "level": "account"}, timeout=12.0)
        r_camp = httpx.get(base, params={"access_token": token, "fields": fields, "time_range": time_range,
                                         "level": "campaign", "limit": 50}, timeout=12.0)
        r_daily = httpx.get(base, params={"access_token": token, "fields": "spend,inline_link_clicks,impressions",
                                          "time_range": time_range, "time_increment": 1, "level": "account", "limit": 100}, timeout=12.0)
        for r in (r_total, r_camp, r_daily):
            if r.status_code != 200:
                msg = ((r.json() or {}).get("error") or {}).get("message", f"HTTP {r.status_code}")
                return {"available": False, "reason": f"Erro na API da Meta: {msg}"}

        def parse(row: Dict[str, Any]) -> Dict[str, Any]:
            def act(lst, names):
                total = 0.0
                for a in lst or []:
                    if a.get("action_type") in names:
                        total += float(a.get("value") or 0)
                return total
            purchase_types = {"purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"}
            purchases = act(row.get("actions"), purchase_types)
            purchase_value = act(row.get("action_values"), purchase_types)
            spend = float(row.get("spend") or 0)
            return {
                "campaign_id": row.get("campaign_id"),
                "campaign_name": row.get("campaign_name"),
                "spend": spend,
                "impressions": int(float(row.get("impressions") or 0)),
                "reach": int(float(row.get("reach") or 0)),
                "clicks": int(float(row.get("inline_link_clicks") or row.get("clicks") or 0)),
                "cpc": float(row.get("cpc") or 0),
                "ctr": float(row.get("ctr") or 0),
                "cpm": float(row.get("cpm") or 0),
                "purchases": purchases,
                "purchase_value": purchase_value,
                "roas": round(purchase_value / spend, 2) if spend > 0 else None,
                "add_to_cart": act(row.get("actions"), {"add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "omni_add_to_cart"}),
                "initiate_checkout": act(row.get("actions"), {"initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"}),
            }

        total_rows = r_total.json().get("data") or []
        total = parse(total_rows[0]) if total_rows else parse({})
        campaigns = sorted([parse(x) for x in (r_camp.json().get("data") or [])], key=lambda c: -c["spend"])
        daily = [{"date": d.get("date_start"), "spend": float(d.get("spend") or 0),
                  "clicks": int(float(d.get("inline_link_clicks") or 0)),
                  "impressions": int(float(d.get("impressions") or 0))} for d in (r_daily.json().get("data") or [])]
        return {"available": True, "total": total, "campaigns": campaigns, "daily": daily}
    except Exception as e:
        logger.warning(f"[Meta Ads] falha ao buscar insights: {e}")
        return {"available": False, "reason": f"Falha de conexão com a Meta: {str(e)[:150]}"}


def fetch_pixel_status(db=None) -> Dict[str, Any]:
    """Último evento recebido pela Meta para o pixel (se o token permitir)."""
    cfg = get_config(db)
    token = cfg.get("ads_token") or cfg.get("capi_token")
    if not token:
        return {"available": False}
    try:
        r = httpx.get(f"https://graph.facebook.com/{GRAPH_VERSION}/{cfg['pixel_id']}",
                      params={"access_token": token, "fields": "name,last_fired_time,is_unavailable"}, timeout=8.0)
        if r.status_code == 200:
            d = r.json()
            return {"available": True, "name": d.get("name"), "last_fired_time": d.get("last_fired_time"),
                    "is_unavailable": d.get("is_unavailable")}
        return {"available": False, "reason": ((r.json() or {}).get("error") or {}).get("message")}
    except Exception as e:
        return {"available": False, "reason": str(e)[:150]}
