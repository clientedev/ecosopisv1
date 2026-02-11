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
    total_clicks = db.query(models.ProductClick).count()
    
    # Clicks by type
    clicks_by_type_raw = db.query(
        models.ProductClick.click_type, 
        func.count(models.ProductClick.id)
    ).group_by(models.ProductClick.click_type).all()
    
    clicks_by_type = {t: c for t, c in clicks_by_type_raw}
    
    # Clicks by product
    clicks_by_product_raw = db.query(
        models.Product.name,
        func.count(models.ProductClick.id).label("count")
    ).join(models.ProductClick, models.Product.id == models.ProductClick.product_id)\
     .group_by(models.Product.name)\
     .order_by(func.count(models.ProductClick.id).desc())\
     .limit(10).all()
     
    clicks_by_product = [{"name": name, "count": count} for name, count in clicks_by_product_raw]
    
    return {
        "total_visits": total_visits,
        "total_clicks": total_clicks,
        "clicks_by_type": clicks_by_type,
        "clicks_by_product": clicks_by_product
    }
