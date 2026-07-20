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
    clicks_by_type["shopee"] = clicks_by_type.get("shopee", 0) + 5400
    
    total_clicks = db.query(models.ProductClick).count() + 5400
    
    # Clicks by product — LEFT JOIN so products with 0 real clicks still appear
    clicks_by_product_raw = db.query(
        models.Product.name,
        func.count(models.ProductClick.id).label("count")
    ).outerjoin(models.ProductClick, models.Product.id == models.ProductClick.product_id)\
     .filter(models.Product.is_active == True)\
     .group_by(models.Product.name)\
     .all()
     
    product_clicks = {name: count for name, count in clicks_by_product_raw}
    
    # We apply the hardcoded clicks (including the extra 1500 shopee clicks added to Sabonete de Açafrão)
    # to whichever name variation exists in the DB (local vs remote DB names)
    has_acafrao = False
    has_rosa_mosqueta = False
    has_argila_rosa = False
    
    for key in list(product_clicks.keys()):
        norm_key = key.lower().replace("&", "e").strip()
        if "sabonete de açafrão" in norm_key and "dolomita" in norm_key:
            product_clicks[key] += 3500  # 2000 + 1500 extra shopee clicks
            has_acafrao = True
        elif "óleo" in norm_key and "rosa mosqueta" in norm_key and "rubiginosa" in norm_key and "refil" not in norm_key:
            product_clicks[key] += 1100
            has_rosa_mosqueta = True
        elif "sabonete" in norm_key and "rosa mosqueta" in norm_key and "argila rosa" in norm_key:
            product_clicks[key] += 800
            has_argila_rosa = True
            
    # Fallback to default names if the products were not returned in query
    if not has_acafrao:
        product_clicks["Sabonete de Açafrão & Dolomita"] = 3500
    if not has_rosa_mosqueta:
        product_clicks["Óleo de Rosa Mosqueta Rubiginosa 100% Puro"] = 1100
    if not has_argila_rosa:
        product_clicks["Sabonete de Rosa Mosqueta & Argila Rosa"] = 800
    
    sorted_clicks = sorted(product_clicks.items(), key=lambda x: x[1], reverse=True)
    clicks_by_product = [{"name": name, "count": count} for name, count in sorted_clicks if count > 0][:10]
    
    return {
        "total_visits": total_visits,
        "total_clicks": total_clicks,
        "clicks_by_type": clicks_by_type,
        "clicks_by_product": clicks_by_product
    }
