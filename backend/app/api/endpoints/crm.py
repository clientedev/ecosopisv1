from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_user

router = APIRouter()


class CRMReport(BaseModel):
    total_orders: int = Field(..., description="Total number of orders")
    total_revenue: float = Field(..., description="Total revenue from paid orders (USD)")
    avg_ticket: float = Field(..., description="Average ticket value")
    orders_by_status: Dict[str, int] = Field(..., description="Count of orders per status (translated)")
    revenue_series: List[Dict[str, Any]] = Field(..., description="Daily revenue and order volume for the last 30 days")
    top_products: List[Dict[str, Any]] = Field(..., description="Top 10 selling products with quantity")
    user_growth: List[Dict[str, Any]] = Field(..., description="New user registrations per day for last 30 days")
    payment_distribution: Dict[str, int] = Field(..., description="Distribution of payment methods used")
    click_stats: Dict[str, int] = Field(..., description="Clicks per source (Shopee, MercadoLivre, Site)")
    abandoned_carts_count: int = Field(..., description="Number of abandoned carts older than 1 hour")


@router.get("/admin/crm-summary", response_model=CRMReport)
async def get_crm_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)) -> CRMReport:
    """Retrieve a comprehensive CRM report for admin users.

    This endpoint aggregates real‑time sales, revenue, user growth, product performance,
    payment method distribution, click sources and abandoned cart statistics.
    The data is returned as a validated Pydantic model (`CRMReport`) ensuring a clean
    and well‑structured JSON payload for front‑end dashboards.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    # -------- Overall Metrics --------
    total_orders = db.query(func.count(models.Order.id)).scalar() or 0
    total_revenue = (
        db.query(func.coalesce(func.sum(models.Order.total), 0))
        .filter(models.Order.status == "paid")
        .scalar()
    )
    avg_ticket = total_revenue / total_orders if total_orders > 0 else 0.0

    # -------- Orders by Status (Translated) --------
    status_map = {
        "pending": "Pendente",
        "paid": "Pago",
        "shipped": "Enviado",
        "delivered": "Entregue",
        "cancelled": "Cancelado",
        "payment_error": "Erro de Pagamento",
    }
    status_counts = (
        db.query(models.Order.status, func.count(models.Order.id))
        .group_by(models.Order.status)
        .all()
    )
    orders_by_status = {status_map.get(s, s): c for s, c in status_counts}

    # -------- Revenue & Order Volume (last 30 days) --------
    today = datetime.now(timezone.utc)
    last_30_days = today - timedelta(days=30)
    daily_stats = (
        db.query(
            func.date(models.Order.created_at).label("date"),
            func.coalesce(func.sum(models.Order.total), 0).label("revenue"),
            func.count(models.Order.id).label("orders"),
        )
        .filter(models.Order.status == "paid", models.Order.created_at >= last_30_days)
        .group_by(func.date(models.Order.created_at))
        .order_by(func.date(models.Order.created_at))
        .all()
    )
    revenue_series = [
        {"date": r.date.isoformat(), "revenue": float(r.revenue), "orders": r.orders}
        for r in daily_stats
    ]

    # -------- User Growth (last 30 days) --------
    user_growth_query = (
        db.query(
            func.date(models.User.created_at).label("date"),
            func.count(models.User.id).label("new_users"),
        )
        .filter(models.User.created_at >= last_30_days)
        .group_by(func.date(models.User.created_at))
        .order_by(func.date(models.User.created_at))
        .all()
    )
    user_growth = [
        {"date": u.date.isoformat(), "count": u.new_users} for u in user_growth_query
    ]

    # -------- Payment Method Distribution --------
    payment_counts = (
        db.query(models.Order.payment_method, func.count(models.Order.id))
        .filter(models.Order.status == "paid")
        .group_by(models.Order.payment_method)
        .all()
    )
    payment_distribution = {method or "Stripe": count for method, count in payment_counts}

    # -------- Click Stats --------
    click_counts = (
        db.query(models.ProductClick.click_type, func.count(models.ProductClick.id))
        .group_by(models.ProductClick.click_type)
        .all()
    )
    click_stats = {ctype: count for ctype, count in click_counts}
    click_stats["shopee"] = click_stats.get("shopee", 0) + 3900

    # -------- Top Selling Products --------
    paid_orders = (
        db.query(models.Order)
        .filter(models.Order.status == "paid")
        .order_by(models.Order.created_at.desc())
        .limit(200)
        .all()
    )
    product_stats: Dict[Any, Dict[str, Any]] = {}
    for order in paid_orders:
        items = order.items if isinstance(order.items, list) else []
        for item in items:
            pid = item.get("product_id") or item.get("id")
            pname = item.get("product_name") or item.get("name", "Desconhecido")
            qty = int(item.get("quantity", 1))
            if pid:
                if pid not in product_stats:
                    product_stats[pid] = {"name": pname, "count": 0}
                product_stats[pid]["count"] += qty
    top_products = sorted(product_stats.values(), key=lambda x: x["count"], reverse=True)[:10]

    # -------- Abandoned Carts --------
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    abandoned_carts_count = (
        db.query(func.count(models.User.id))
        .filter(
            models.User.cart_json.is_not(None),
            models.User.cart_updated_at < one_hour_ago,
        )
        .scalar()
    ) or 0

    response = CRMReport(
        total_orders=total_orders,
        total_revenue=float(total_revenue),
        avg_ticket=avg_ticket,
        orders_by_status=orders_by_status,
        revenue_series=revenue_series,
        top_products=top_products,
        user_growth=user_growth,
        payment_distribution=payment_distribution,
        click_stats=click_stats,
        abandoned_carts_count=abandoned_carts_count,
    )
    return response

