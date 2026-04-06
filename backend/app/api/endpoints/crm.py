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

    # Orders by Status (Translated)
    status_map = {
        "pending": "Pendente",
        "paid": "Pago",
        "shipped": "Enviado",
        "delivered": "Entregue",
        "cancelled": "Cancelado",
        "payment_error": "Erro de Pagamento"
    }
    status_counts = db.query(models.Order.status, func.count(models.Order.id)).group_by(models.Order.status).all()
    orders_by_status = {status_map.get(s, s): count for s, count in status_counts}

    # Timeframe
    today = datetime.now(timezone.utc)
    last_30_days = today - timedelta(days=30)

    # Revenue & Order Volume last 30 days
    daily_stats = db.query(
        func.date(models.Order.created_at).label('date'),
        func.sum(models.Order.total).label('revenue'),
        func.count(models.Order.id).label('orders')
    ).filter(
        models.Order.status == "paid",
        models.Order.created_at >= last_30_days
    ).group_by(func.date(models.Order.created_at)).all()

    revenue_series = [{"date": str(r.date), "revenue": r.revenue, "orders": r.orders} for r in daily_stats]

    # User Growth last 30 days
    user_growth_query = db.query(
        func.date(models.User.created_at).label('date'),
        func.count(models.User.id).label('new_users')
    ).filter(
        models.User.created_at >= last_30_days
    ).group_by(func.date(models.User.created_at)).all()
    user_growth = [{"date": str(u.date), "count": u.new_users} for u in user_growth_query]

    # Payment Method Distribution (Stripe is default)
    payment_counts = db.query(models.Order.payment_method, func.count(models.Order.id)).filter(models.Order.status == "paid").group_by(models.Order.payment_method).all()
    payment_distribution = {method or "Stripe": count for method, count in payment_counts}

    # Product Click Stats (Shopee vs MercadoLivre vs Site)
    click_counts = db.query(models.ProductClick.click_type, func.count(models.ProductClick.id)).group_by(models.ProductClick.click_type).all()
    click_stats = {ctype: count for ctype, count in click_counts}

    # Top Selling Products (extracting from JSON items)
    all_paid_orders = db.query(models.Order).filter(models.Order.status == "paid").order_by(models.Order.created_at.desc()).limit(200).all()
    product_stats = {}
    for order in all_paid_orders:
        items = order.items if isinstance(order.items, list) else []
        for item in items:
            p_id = item.get("product_id") or item.get("id")
            p_name = item.get("product_name") or item.get("name", "Desconhecido")
            qty = item.get("quantity", 1)
            if p_id:
                if p_id not in product_stats:
                    product_stats[p_id] = {"name": p_name, "count": 0}
                product_stats[p_id]["count"] += qty

    top_products = sorted(product_stats.values(), key=lambda x: x["count"], reverse=True)[:10]

    # Abandoned Carts
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    abandoned_carts_count = db.query(func.count(models.User.id)).filter(
        models.User.cart_json.is_not(None),
        models.User.cart_updated_at < one_hour_ago
    ).scalar() or 0

    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_ticket": avg_ticket,
        "orders_by_status": orders_by_status,
        "revenue_series": revenue_series,
        "top_products": top_products,
        "user_growth": user_growth,
        "payment_distribution": payment_distribution,
        "click_stats": click_stats,
        "abandoned_carts_count": abandoned_carts_count
    }
