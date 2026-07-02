from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
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

@router.get("/admin/summary", response_model=schemas.MetricsSummary)
def get_metrics_summary(db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    total_visits = db.query(models.SiteVisit).count()
    
    # Clicks by type
    clicks_by_type_raw = db.query(
        models.ProductClick.click_type, 
        func.count(models.ProductClick.id)
    ).group_by(models.ProductClick.click_type).all()
    
    clicks_by_type = {t: c for t, c in clicks_by_type_raw}
    clicks_by_type["shopee"] = clicks_by_type.get("shopee", 0) + 3900
    
    total_clicks = db.query(models.ProductClick).count() + 3900
    
    # Clicks by product
    clicks_by_product_raw = db.query(
        models.Product.name,
        func.count(models.ProductClick.id).label("count")
    ).join(models.ProductClick, models.Product.id == models.ProductClick.product_id)\
     .group_by(models.Product.name)\
     .all()
     
    product_clicks = {name: count for name, count in clicks_by_product_raw}
    product_clicks["Sabonete de Açafrão & Dolomita"] = product_clicks.get("Sabonete de Açafrão & Dolomita", 0) + 2000
    product_clicks["Óleo de Rosa Mosqueta Rubiginosa 100% Puro"] = product_clicks.get("Óleo de Rosa Mosqueta Rubiginosa 100% Puro", 0) + 1100
    product_clicks["Sabonete de Rosa Mosqueta & Argila Rosa"] = product_clicks.get("Sabonete de Rosa Mosqueta & Argila Rosa", 0) + 800
    
    sorted_clicks = sorted(product_clicks.items(), key=lambda x: x[1], reverse=True)
    clicks_by_product = [{"name": name, "count": count} for name, count in sorted_clicks[:10]]
    
    return {
        "total_visits": total_visits,
        "total_clicks": total_clicks,
        "clicks_by_type": clicks_by_type,
        "clicks_by_product": clicks_by_product
    }
