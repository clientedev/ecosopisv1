from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from datetime import datetime, timedelta, timezone
from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_user

router = APIRouter()

@router.get("/admin/crm-summary")
async def get_crm_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Overall Metrics
    total_orders = db.query(func.count(models.Order.id)).scalar() or 0
    total_revenue = db.query(func.sum(models.Order.total)).filter(models.Order.status == "paid").scalar() or 0
    avg_ticket = total_revenue / total_orders if total_orders > 0 else 0

    # Orders by Status
    status_counts = db.query(models.Order.status, func.count(models.Order.id)).group_by(models.Order.status).all()
    orders_by_status = {status: count for status, count in status_counts}

    # Revenue last 30 days (simplified)
    today = datetime.now(timezone.utc)
    last_30_days = today - timedelta(days=30)
    daily_revenue = db.query(
        func.date(models.Order.created_at).label('date'),
        func.sum(models.Order.total).label('revenue')
    ).filter(
        models.Order.status == "paid",
        models.Order.created_at >= last_30_days
    ).group_by(func.date(models.Order.created_at)).all()

    revenue_series = [{"date": str(r.date), "revenue": r.revenue} for r in daily_revenue]

    # Top Selling Products (extracting from JSON items)
    # Note: In a real SQL db, this might be a complex JSON query. 
    # For now, we'll fetch recent orders and aggregate in Python for simplicity/compatibility.
    all_paid_orders = db.query(models.Order).filter(models.Order.status == "paid").limit(100).all()
    product_stats = {}
    for order in all_paid_orders:
        items = order.items if isinstance(order.items, list) else []
        for item in items:
            p_id = item.get("id")
            p_name = item.get("name", "Desconhecido")
            qty = item.get("quantity", 1)
            if p_id:
                if p_id not in product_stats:
                    product_stats[p_id] = {"name": p_name, "count": 0}
                product_stats[p_id]["count"] += qty

    top_products = sorted(product_stats.values(), key=lambda x: x["count"], reverse=True)[:5]

    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_ticket": avg_ticket,
        "orders_by_status": orders_by_status,
        "revenue_series": revenue_series,
        "top_products": top_products
    }
