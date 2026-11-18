"""
Rotas Meta (Facebook/Instagram Ads):
  POST /api/meta/track            – evento do navegador (registra no CRM + repassa p/ CAPI)
  GET  /api/meta/config           – pixel id público (usado pelo frontend)
  GET  /api/meta/admin/config     – configuração (tokens mascarados)
  PUT  /api/meta/admin/config     – salva pixel/tokens no system_settings
  POST /api/meta/admin/test       – envia evento de teste p/ validar o token da CAPI
  GET  /api/meta/admin/dashboard  – métricas Meta para a tela do CRM
"""
from __future__ import annotations

import logging
import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_admin
from app.core.database import SessionLocal, get_db
from app.models import models
from app.services import meta_capi

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_EVENTS = {"PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase", "Search", "Lead", "CompleteRegistration"}
PAID_STATUSES = {"paid", "shipped", "delivered", "processando_envio", "erro_envio", "PROCESSANDO_ENVIO", "ERRO_ENVIO"}


class TrackIn(BaseModel):
    event_name: str
    event_id: str = Field(..., max_length=120)
    url: Optional[str] = None
    path: Optional[str] = None
    visitor_id: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    external_id: Optional[str] = None
    fbp: Optional[str] = Field(None, max_length=200)
    fbc: Optional[str] = Field(None, max_length=400)


def _send_capi_async(event: Dict[str, Any], meta_event_id: int) -> None:
    def runner():
        db = SessionLocal()
        try:
            res = meta_capi.send_events([event], db)
            row = db.query(models.MetaEvent).filter(models.MetaEvent.id == meta_event_id).first()
            if row:
                row.capi_status = res.get("status")
                row.capi_error = res.get("error")
                db.commit()
        except Exception as e:
            logger.debug(f"[Meta] CAPI async falhou: {e}")
        finally:
            db.close()
    threading.Thread(target=runner, daemon=True, name="meta-capi").start()


@router.post("/track")
def track_event(body: TrackIn, request: Request, db: Session = Depends(get_db)):
    if body.event_name not in ALLOWED_EVENTS:
        raise HTTPException(status_code=400, detail="Evento não suportado")
    # Purchase é sempre enviado pelo servidor na aprovação do pagamento.
    if body.event_name == "Purchase":
        return {"status": "ignored"}

    ctx = dict(meta_capi.get_request_context() or {})
    # fallback: cookies enviados no corpo quando o proxy não repassa o header Cookie
    if not ctx.get("fbp") and body.fbp and body.fbp.startswith("fb."):
        ctx["fbp"] = body.fbp
    if not ctx.get("fbc") and body.fbc and body.fbc.startswith("fb."):
        ctx["fbc"] = body.fbc
    attr = ctx.get("attr") or {}
    cd = body.custom_data or {}
    value = None
    try:
        value = float(cd.get("value")) if cd.get("value") is not None else None
    except Exception:
        value = None
    product_id = None
    try:
        ids = cd.get("content_ids") or []
        product_id = int(ids[0]) if ids else None
    except Exception:
        product_id = None

    row = models.MetaEvent(
        event_name=body.event_name,
        event_id=body.event_id[:120],
        source="browser",
        path=(body.path or "")[:300] or None,
        is_meta_traffic=meta_capi.is_meta_source(attr.get("utm_source"), ctx.get("fbc")),
        utm_source=attr.get("utm_source"),
        utm_medium=attr.get("utm_medium"),
        utm_campaign=attr.get("utm_campaign"),
        utm_content=attr.get("utm_content"),
        value=value,
        product_id=product_id,
        visitor_id=(body.visitor_id or ctx.get("fbp") or "")[:120] or None,
        capi_status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    ud = meta_capi.build_user_data(
        email=body.email, phone=body.phone, external_id=body.external_id or body.email,
        fbp=ctx.get("fbp"), fbc=ctx.get("fbc"), ip=ctx.get("ip"), ua=ctx.get("ua"),
    )
    allowed_cd = {k: cd.get(k) for k in ("currency", "value", "content_ids", "content_type", "contents", "content_name", "num_items") if cd.get(k) is not None}
    event = meta_capi.build_event(body.event_name, body.event_id, ud, allowed_cd, body.url)
    _send_capi_async(event, row.id)
    return {"status": "ok"}


@router.get("/config")
def public_config(db: Session = Depends(get_db)):
    cfg = meta_capi.get_config(db)
    return {"pixel_id": cfg.get("pixel_id")}


# ── Admin ─────────────────────────────────────────────────────────────────────
def _mask(token: Optional[str]) -> str:
    if not token:
        return ""
    return f"{token[:6]}…{token[-4:]}" if len(token) > 12 else "••••"


class ConfigIn(BaseModel):
    pixel_id: Optional[str] = None
    capi_token: Optional[str] = None
    test_event_code: Optional[str] = None
    ads_token: Optional[str] = None
    ad_account_id: Optional[str] = None


@router.get("/admin/config")
def get_admin_config(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    cfg = meta_capi.get_config(db, force=True)
    return {
        "pixel_id": cfg.get("pixel_id"),
        "ad_account_id": cfg.get("ad_account_id"),
        "test_event_code": cfg.get("test_event_code"),
        "capi_token_set": bool(cfg.get("capi_token")),
        "capi_token_masked": _mask(cfg.get("capi_token")),
        "ads_token_set": bool(cfg.get("ads_token")),
        "ads_token_masked": _mask(cfg.get("ads_token")),
    }


@router.put("/admin/config")
def update_admin_config(body: ConfigIn, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    mapping = {
        "pixel_id": "meta_pixel_id",
        "capi_token": "meta_capi_token",
        "test_event_code": "meta_test_event_code",
        "ads_token": "meta_ads_token",
        "ad_account_id": "meta_ad_account_id",
    }
    for field, key in mapping.items():
        val = getattr(body, field)
        if val is None:
            continue  # campo não enviado = mantém
        val = val.strip()
        row = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
        if row:
            row.value = val
        else:
            db.add(models.SystemSetting(key=key, value=val))
    db.commit()
    meta_capi.invalidate_config_cache()
    return get_admin_config(db, admin)


@router.post("/admin/test")
def send_test_event(request: Request, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    ctx = meta_capi.get_request_context()
    ud = meta_capi.build_user_data(email=getattr(admin, "email", None), ip=ctx.get("ip"), ua=ctx.get("ua") or "ecosopis-admin-test")
    ev = meta_capi.build_event("PageView", f"admin_test_{int(datetime.now().timestamp())}", ud, None, meta_capi.SITE_URL + "/admin")
    res = meta_capi.send_events([ev], db)
    return {"ok": res.get("ok"), "status": res.get("status"), "error": res.get("error"), "response": res.get("response")}


def _period_days(period: str) -> int:
    return {"7d": 7, "14d": 14, "30d": 30, "90d": 90}.get(period, 30)


@router.get("/admin/dashboard")
def meta_dashboard(period: str = "30d", db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    days = _period_days(period)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    start_naive = start.replace(tzinfo=None)

    def since(col):
        return col >= start_naive if db.bind.dialect.name == "sqlite" else col >= start

    # ── Funil (eventos do próprio site) ───────────────────────────────────────
    events = db.query(
        models.MetaEvent.event_name, models.MetaEvent.is_meta_traffic, models.MetaEvent.visitor_id,
        models.MetaEvent.created_at, models.MetaEvent.source, models.MetaEvent.capi_status,
        models.MetaEvent.utm_campaign,
    ).filter(since(models.MetaEvent.created_at)).all()

    funnel_names = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"]
    funnel_all = {n: 0 for n in funnel_names}
    funnel_meta = {n: 0 for n in funnel_names}
    visitors_all, visitors_meta = set(), set()
    capi = {"sent": 0, "error": 0, "skipped": 0, "pending": 0}
    daily = defaultdict(lambda: {"visitors": set(), "meta_visitors": set(), "meta_orders": 0, "meta_revenue": 0.0, "orders": 0, "revenue": 0.0})
    campaign_visits = defaultdict(set)

    for name, is_meta, vid, created, source, capi_status, campaign in events:
        if capi_status in capi:
            capi[capi_status] += 1
        if source == "server":
            continue  # Purchase do servidor é contado pelos pedidos
        if name in funnel_all:
            funnel_all[name] += 1
            if is_meta:
                funnel_meta[name] += 1
        if name == "PageView" and vid:
            visitors_all.add(vid)
            day = (created or now).date().isoformat()
            daily[day]["visitors"].add(vid)
            if is_meta:
                visitors_meta.add(vid)
                daily[day]["meta_visitors"].add(vid)
                campaign_visits[campaign or "(sem campanha)"].add(vid)

    last_error_row = db.query(models.MetaEvent).filter(models.MetaEvent.capi_status == "error").order_by(models.MetaEvent.id.desc()).first()

    # ── Pedidos (CRM) ─────────────────────────────────────────────────────────
    orders = db.query(models.Order).filter(since(models.Order.created_at)).all()
    paid_all = [o for o in orders if o.status in PAID_STATUSES]
    meta_orders = [o for o in orders if meta_capi.is_meta_source(o.utm_source, o.meta_fbc)]
    meta_paid = [o for o in meta_orders if o.status in PAID_STATUSES]

    rev_all = sum(float(o.total or 0) for o in paid_all)
    rev_meta = sum(float(o.total or 0) for o in meta_paid)
    funnel_all["Purchase"] = len(paid_all)
    funnel_meta["Purchase"] = len(meta_paid)

    for o in paid_all:
        day = (o.created_at or now).date().isoformat()
        daily[day]["orders"] += 1
        daily[day]["revenue"] += float(o.total or 0)
    for o in meta_paid:
        day = (o.created_at or now).date().isoformat()
        daily[day]["meta_orders"] += 1
        daily[day]["meta_revenue"] += float(o.total or 0)

    campaigns: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"orders": 0, "paid_orders": 0, "revenue": 0.0, "visitors": 0})
    for o in meta_orders:
        c = campaigns[o.utm_campaign or "(sem campanha)"]
        c["orders"] += 1
        if o.status in PAID_STATUSES:
            c["paid_orders"] += 1
            c["revenue"] += float(o.total or 0)
    for camp, vids in campaign_visits.items():
        campaigns[camp]["visitors"] = len(vids)

    source_breakdown: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
    for o in paid_all:
        src = (o.utm_source or ("meta (fbclid)" if o.meta_fbc else "direto / orgânico")).lower()
        source_breakdown[src]["orders"] += 1
        source_breakdown[src]["revenue"] += float(o.total or 0)

    recent = sorted(meta_orders, key=lambda o: o.id, reverse=True)[:15]

    # ── Meta Ads (gasto real) ─────────────────────────────────────────────────
    ads = meta_capi.fetch_ads_insights(start.date().isoformat(), now.date().isoformat(), db)
    pixel = meta_capi.fetch_pixel_status(db)
    if ads.get("available"):
        for d in ads.get("daily", []):
            daily[d["date"]]["spend"] = d["spend"]
            daily[d["date"]]["ad_clicks"] = d["clicks"]
    spend = (ads.get("total") or {}).get("spend") if ads.get("available") else None

    days_list = []
    for i in range(days, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        row = daily.get(d) or {}
        days_list.append({
            "date": d,
            "visitors": len(row.get("visitors", set())),
            "meta_visitors": len(row.get("meta_visitors", set())),
            "orders": row.get("orders", 0),
            "revenue": round(row.get("revenue", 0.0), 2),
            "meta_orders": row.get("meta_orders", 0),
            "meta_revenue": round(row.get("meta_revenue", 0.0), 2),
            "spend": round(row.get("spend", 0.0), 2),
            "ad_clicks": row.get("ad_clicks", 0),
        })

    cfg = meta_capi.get_config(db)
    return {
        "period": period,
        "setup": {
            "pixel_id": cfg.get("pixel_id"),
            "capi_configured": bool(cfg.get("capi_token")),
            "ads_configured": bool(ads.get("available")),
            "ads_reason": ads.get("reason"),
            "pixel_status": pixel,
            "capi_events": capi,
            "last_capi_error": (last_error_row.capi_error if last_error_row else None),
            "events_received": len(events),
        },
        "kpis": {
            "visitors": len(visitors_all),
            "meta_visitors": len(visitors_meta),
            "orders": len(paid_all),
            "revenue": round(rev_all, 2),
            "meta_orders": len(meta_paid),
            "meta_orders_started": len(meta_orders),
            "meta_revenue": round(rev_meta, 2),
            "meta_aov": round(rev_meta / len(meta_paid), 2) if meta_paid else 0,
            "meta_conversion_rate": round(100 * len(meta_paid) / len(visitors_meta), 2) if visitors_meta else 0,
            "site_conversion_rate": round(100 * len(paid_all) / len(visitors_all), 2) if visitors_all else 0,
            "meta_share_revenue": round(100 * rev_meta / rev_all, 1) if rev_all else 0,
            "spend": round(spend, 2) if spend is not None else None,
            "roas_site": round(rev_meta / spend, 2) if spend else None,
            "cpa_site": round(spend / len(meta_paid), 2) if spend and meta_paid else None,
        },
        "funnel": [{"step": n, "all": funnel_all[n], "meta": funnel_meta[n]} for n in funnel_names],
        "daily": days_list,
        "campaigns": sorted(
            [{"campaign": k, **{kk: (round(vv, 2) if isinstance(vv, float) else vv) for kk, vv in v.items()}} for k, v in campaigns.items()],
            key=lambda x: -x["revenue"],
        )[:20],
        "sources": sorted(
            [{"source": k, "orders": v["orders"], "revenue": round(v["revenue"], 2)} for k, v in source_breakdown.items()],
            key=lambda x: -x["revenue"],
        ),
        "recent_orders": [{
            "id": o.id,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "customer": o.customer_name or o.buyer_name or "Cliente",
            "total": round(float(o.total or 0), 2),
            "status": o.status,
            "utm_source": o.utm_source,
            "utm_campaign": o.utm_campaign,
            "utm_content": o.utm_content,
            "capi_sent": bool(o.meta_capi_sent_at),
        } for o in recent],
        "ads": ads,
    }


# ── Feed de produtos para o Catálogo da Meta ──────────────────────────────────
# URL pública para "Fonte de dados > Feed programado" no Gerenciador de Comércio:
#   https://www.ecosopis.com.br/api/meta/catalog.xml
# Os IDs são os mesmos do site, então batem com os content_ids do Pixel/CAPI.
from fastapi.responses import Response as _Response
from xml.sax.saxutils import escape as _xml_escape
import re as _re


def _abs_url(u: Optional[str]) -> Optional[str]:
    if not u:
        return None
    u = str(u).strip()
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("http://") or u.startswith("https://"):
        return u
    return meta_capi.SITE_URL.rstrip("/") + "/" + u.lstrip("/")


def _plain(text: Optional[str], limit: int = 4900) -> str:
    t = _re.sub(r"<[^>]+>", " ", text or "")
    t = _re.sub(r"\s+", " ", t).strip()
    return t[:limit]


@router.get("/catalog.xml")
def catalog_feed(db: Session = Depends(get_db)):
    products = (
        db.query(models.Product)
        .filter(models.Product.is_active == True)  # noqa: E712
        .order_by(models.Product.order.asc(), models.Product.id.asc())
        .all()
    )
    site = meta_capi.SITE_URL.rstrip("/")
    items = []
    for p in products:
        # is_wholesale indica que o produto TAMBÉM é vendido no atacado — continua à venda no varejo
        if getattr(p, "buy_on_site", True) is False:
            continue
        price = float(p.price or 0)
        if price <= 0 or not p.slug:
            continue
        image = _abs_url(p.image_url) or next((_abs_url(x) for x in (p.images or []) if x), None)
        if not image:
            continue
        extra_imgs = [_abs_url(x) for x in (p.images or []) if x and _abs_url(x) != image][:9]
        desc = _plain(p.description) or _plain(p.benefits) or p.name
        fields = {
            "g:id": str(p.id),
            "g:title": p.name[:150],
            "g:description": desc,
            "g:link": f"{site}/produtos/{p.slug}",
            "g:image_link": image,
            "g:availability": "in stock" if (p.stock or 0) > 0 else "out of stock",
            "g:condition": "new",
            "g:price": f"{price:.2f} BRL",
            "g:brand": "Ecosopis",
        }
        if p.is_on_sale and p.sale_price and 0 < float(p.sale_price) < price:
            fields["g:sale_price"] = f"{float(p.sale_price):.2f} BRL"
        if p.category:
            fields["g:product_type"] = p.category
        if (p.stock or 0) > 0:
            fields["g:quantity_to_sell_on_facebook"] = str(int(p.stock))
        xml = "".join(f"<{k}>{_xml_escape(str(v))}</{k}>" for k, v in fields.items())
        xml += "".join(f"<g:additional_image_link>{_xml_escape(u)}</g:additional_image_link>" for u in extra_imgs)
        items.append(f"<item>{xml}</item>")

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel>'
        f"<title>Ecosopis</title><link>{site}</link><description>Catálogo Ecosopis</description>"
        + "".join(items)
        + "</channel></rss>"
    )
    return _Response(content=body, media_type="application/xml", headers={"Cache-Control": "public, max-age=900"})
