from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import List, Dict, Any
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin

router = APIRouter()

@router.post("/log/visit", status_code=status.HTTP_201_CREATED)
def log_visit(visit_log: schemas.SiteVisitLog, db: Session = Depends(get_db)):
    new_visit = models.SiteVisit(path=visit_log.path)
    db.add(new_visit)
    db.commit()
    return {"status": "success"}

@router.post("/log/click", status_code=status.HTTP_201_CREATED)
def log_click(click_log: schemas.ProductClickLog, db: Session = Depends(get_db)):
    new_click = models.ProductClick(
        product_id=click_log.product_id,
        click_type=click_log.click_type
    )
    db.add(new_click)
    db.commit()
    return {"status": "success"}

@router.get("/admin/bi-analytics")
def get_bi_analytics(
    period: str = "30d",
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    if period == "7d":
        days_count = 7
    elif period == "90d":
        days_count = 90
    elif period == "all":
        days_count = 365
    else:
        days_count = 30

    start_date = now - timedelta(days=days_count)

    # -------------------------------------------------------------
    # 1. VISITS ANALYTICS — dados reais apenas
    # -------------------------------------------------------------
    total_visits = db.query(models.SiteVisit).filter(
        models.SiteVisit.created_at >= start_date
    ).count()

    raw_paths = db.query(
        models.SiteVisit.path,
        func.count(models.SiteVisit.id)
    ).filter(
        models.SiteVisit.created_at >= start_date
    ).group_by(models.SiteVisit.path).all()

    path_map: Dict[str, int] = {}
    for path_name, count in raw_paths:
        clean_path = path_name or "/"
        if clean_path.startswith("/produto"):
            clean_path = "Página de Produtos"
        elif clean_path == "/":
            clean_path = "Home / Início"
        elif "/quizz" in clean_path:
            clean_path = "Quiz de Pele"
        elif "/lia" in clean_path:
            clean_path = "LIA Consultora IA"
        elif "/atacado" in clean_path:
            clean_path = "Atacado"
        elif "/raspadinha" in clean_path:
            clean_path = "Raspadinha Prêmios"
        path_map[clean_path] = path_map.get(clean_path, 0) + count

    top_paths = [{"path": k, "visits": v} for k, v in sorted(path_map.items(), key=lambda x: x[1], reverse=True)[:6]]

    # Timeline de visitas por dia — dados reais
    visits_by_day_raw = db.query(
        cast(models.SiteVisit.created_at, Date).label("day"),
        func.count(models.SiteVisit.id).label("cnt")
    ).filter(
        models.SiteVisit.created_at >= start_date
    ).group_by("day").order_by("day").all()

    visits_by_day = {str(row.day): row.cnt for row in visits_by_day_raw}
    visits_timeline = []
    for i in range(days_count - 1, -1, -1):
        dt = now - timedelta(days=i)
        day_key = dt.strftime("%Y-%m-%d")
        dt_label = dt.strftime("%d/%m")
        visits_timeline.append({"date": dt_label, "visits": visits_by_day.get(day_key, 0)})

    # -------------------------------------------------------------
    # 2. PRODUCT CLICKS ANALYTICS — dados reais apenas
    # -------------------------------------------------------------
    clicks_raw = db.query(
        models.ProductClick.click_type,
        func.count(models.ProductClick.id)
    ).filter(models.ProductClick.created_at >= start_date).group_by(models.ProductClick.click_type).all()

    clicks_by_type = {t: c for t, c in clicks_raw}
    total_shopee_clicks = clicks_by_type.get("shopee", 0)
    total_site_clicks = clicks_by_type.get("site", 0)
    total_ml_clicks = clicks_by_type.get("mercadolivre", 0)

    channel_distribution = [
        {"name": "Shopee", "value": total_shopee_clicks, "color": "#ee4d2d"},
        {"name": "Loja Própria (Comprar)", "value": total_site_clicks, "color": "#4a7c59"},
        {"name": "Mercado Livre", "value": total_ml_clicks, "color": "#f59e0b"}
    ]

    # Top produtos por cliques (shopee) — dados reais
    product_shopee_raw = db.query(
        models.Product.name,
        func.count(models.ProductClick.id).label("count")
    ).join(models.ProductClick, models.Product.id == models.ProductClick.product_id)\
     .filter(
         models.ProductClick.click_type == "shopee",
         models.ProductClick.created_at >= start_date
     )\
     .group_by(models.Product.name)\
     .order_by(func.count(models.ProductClick.id).desc())\
     .limit(8).all()

    top_shopee_products = [{"name": name, "clicks": count} for name, count in product_shopee_raw]

    # Timeline de cliques shopee e site por dia — dados reais
    shopee_by_day_raw = db.query(
        cast(models.ProductClick.created_at, Date).label("day"),
        models.ProductClick.click_type,
        func.count(models.ProductClick.id).label("cnt")
    ).filter(
        models.ProductClick.created_at >= start_date
    ).group_by("day", models.ProductClick.click_type).order_by("day").all()

    shopee_day: Dict[str, int] = {}
    site_day: Dict[str, int] = {}
    for row in shopee_by_day_raw:
        day_key = str(row.day)
        if row.click_type == "shopee":
            shopee_day[day_key] = shopee_day.get(day_key, 0) + row.cnt
        elif row.click_type == "site":
            site_day[day_key] = site_day.get(day_key, 0) + row.cnt

    clicks_timeline = []
    for i in range(days_count - 1, -1, -1):
        dt = now - timedelta(days=i)
        day_key = dt.strftime("%Y-%m-%d")
        dt_label = dt.strftime("%d/%m")
        clicks_timeline.append({
            "date": dt_label,
            "shopee": shopee_day.get(day_key, 0),
            "site": site_day.get(day_key, 0)
        })

    # -------------------------------------------------------------
    # 3. SITE BUY CLICKS — dados reais apenas
    # -------------------------------------------------------------
    top_site_raw = db.query(
        models.Product.name,
        func.count(models.ProductClick.id).label("count")
    ).join(models.ProductClick, models.Product.id == models.ProductClick.product_id)\
     .filter(
         models.ProductClick.click_type == "site",
         models.ProductClick.created_at >= start_date
     )\
     .group_by(models.Product.name)\
     .order_by(func.count(models.ProductClick.id).desc())\
     .limit(8).all()

    top_site_clicked = [{"name": name, "clicks": count} for name, count in top_site_raw]

    buy_clicks_timeline = [{"date": item["date"], "clicks": item["site"]} for item in clicks_timeline]

    # -------------------------------------------------------------
    # 4. LIA AI INTERACTIONS — dados reais apenas
    # -------------------------------------------------------------
    total_lia_interactions = db.query(models.LiaInteraction).filter(
        models.LiaInteraction.created_at >= start_date
    ).count()

    lia_topics_raw = db.query(
        models.LiaInteraction.topic,
        func.count(models.LiaInteraction.id)
    ).filter(
        models.LiaInteraction.created_at >= start_date,
        models.LiaInteraction.topic != None
    ).group_by(models.LiaInteraction.topic).order_by(func.count(models.LiaInteraction.id).desc()).all()

    topics_breakdown = [{"topic": t or "Geral", "count": c} for t, c in lia_topics_raw]

    # Perguntas mais recentes reais
    recent_interactions_db = db.query(models.LiaInteraction)\
        .filter(models.LiaInteraction.created_at >= start_date)\
        .order_by(models.LiaInteraction.created_at.desc())\
        .limit(10).all()

    recent_queries = [
        {
            "message": item.user_message,
            "topic": item.topic or "Geral",
            "date": item.created_at.strftime("%d/%m %H:%M") if item.created_at else ""
        }
        for item in recent_interactions_db
    ]

    # Timeline de chats LIA por dia — dados reais
    lia_by_day_raw = db.query(
        cast(models.LiaInteraction.created_at, Date).label("day"),
        func.count(models.LiaInteraction.id).label("cnt")
    ).filter(
        models.LiaInteraction.created_at >= start_date
    ).group_by("day").order_by("day").all()

    lia_by_day = {str(row.day): row.cnt for row in lia_by_day_raw}
    lia_timeline = []
    for i in range(days_count - 1, -1, -1):
        dt = now - timedelta(days=i)
        day_key = dt.strftime("%Y-%m-%d")
        dt_label = dt.strftime("%d/%m")
        lia_timeline.append({"date": dt_label, "chats": lia_by_day.get(day_key, 0)})

    # CTR real
    ctr = round((total_site_clicks / max(1, total_visits)) * 100, 2) if total_visits > 0 else 0.0

    return {
        "period": period,
        "summary_kpis": {
            "total_site_clicks": total_site_clicks,
            "shopee_clicks": total_shopee_clicks,
            "site_visits": total_visits,
            "lia_interactions": total_lia_interactions,
            "click_through_rate": ctr
        },
        "shopee_analytics": {
            "total_shopee_clicks": total_shopee_clicks,
            "top_shopee_products": top_shopee_products,
            "channel_distribution": channel_distribution,
            "clicks_timeline": clicks_timeline
        },
        "site_clicks_analytics": {
            "total_site_clicks": total_site_clicks,
            "top_site_clicked": top_site_clicked,
            "buy_clicks_timeline": buy_clicks_timeline
        },
        "visits_analytics": {
            "total_visits": total_visits,
            "top_paths": top_paths,
            "visits_timeline": visits_timeline
        },
        "lia_analytics": {
            "total_lia_interactions": total_lia_interactions,
            "topics_breakdown": topics_breakdown,
            "recent_queries": recent_queries,
            "lia_timeline": lia_timeline
        }
    }
