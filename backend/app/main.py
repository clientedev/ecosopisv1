from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import traceback
import logging
import os
import stripe
from dotenv import load_dotenv

from app.core.database import engine, Base, get_db, SessionLocal
from app.models import models

# Load environment variables
load_dotenv()

# Initialize logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
stripe.api_version = "2024-04-10"

# Migration logic removed from module level for stability, 
# called explicitly in a robust block later.
def _apply_startup_migrations():
    import bcrypt as _bcrypt
    from sqlalchemy import text
    
    # Columns definitions
    USER_COLS = [
        ("is_verified",        "BOOLEAN DEFAULT FALSE"),
        ("verification_token", "VARCHAR"),
        ("cart_json",          "TEXT"),
        ("cart_updated_at",    "TIMESTAMP WITH TIME ZONE"),
        ("can_post_news",      "BOOLEAN DEFAULT FALSE"),
        ("total_compras",      "INTEGER DEFAULT 0"),
        ("pode_girar_roleta",  "BOOLEAN DEFAULT FALSE"),
        ("tentativas_roleta",  "INTEGER DEFAULT 0"),
        ("ultimo_premio_id",   "INTEGER"),
        ("profile_picture",    "VARCHAR")
    ]
    ORDER_COLS = [
        ("mercadopago_preference_id", "VARCHAR"),
        ("mercadopago_payment_id",    "VARCHAR"),
        ("payment_method",           "VARCHAR DEFAULT 'stripe'"),
        ("shipping_method",          "VARCHAR"),
        ("shipping_price",           "DOUBLE PRECISION DEFAULT 0"),
        ("stripe_payment_id",        "VARCHAR"),
        ("stripe_session_id",        "VARCHAR"),
        ("codigo_rastreio",          "VARCHAR"),
        ("etiqueta_url",             "VARCHAR"),
        ("shipment_id",              "VARCHAR"),
        ("customer_cpf",             "VARCHAR")
    ]
    
    with engine.connect() as conn:
        for table, cols in [("users", USER_COLS), ("orders", ORDER_COLS)]:
            for col, defn in cols:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {defn}"))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Migration: Could not ensure {table}.{col}: {e}")
                    conn.rollback()

# Initialize FastAPI
app = FastAPI(title="ECOSOPIS API", version="1.1.0")

# Apply migrations on startup
@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Running startup migrations...")
        _apply_startup_migrations()
        # Create tables from models
        Base.metadata.create_all(bind=engine)
        logger.info("Startup completed successfully.")
    except Exception as e:
        logger.error(f"Startup Failure: {e}", exc_info=True)

# Static files
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/qrcodes", exist_ok=True)
os.makedirs("static/labels", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    stack = traceback.format_exc()
    logger.error(f"GLOBAL ERROR: {str(exc)}\n{stack}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Erro interno: {str(exc)}", "path": request.url.path}
    )

# Diagnostic Route
@app.get("/diagnostic")
async def diagnostic(db: Session = Depends(get_db)):
    status = {"database": "OK", "tables": {}, "env": {}}
    try:
        for table in ["users", "orders", "products", "order_items"]:
            cols = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'")).fetchall()
            status["tables"][table] = [c[0] for c in cols]
        status["env"]["STRIPE"] = "SET" if os.getenv("STRIPE_SECRET_KEY") else "MISSING"
        status["env"]["MP"] = "SET" if os.getenv("MP_ACCESS_TOKEN") else "MISSING"
    except Exception as e:
        status["database"] = f"CRITICAL: {str(e)}"
    return status

@app.get("/")
async def root():
    return {"status": "online", "service": "ECOSOPIS"}

# Import and include routers
from app.api.endpoints import (
    auth, products, coupons, carousel, orders, settings, reviews, 
    images, news, metrics, chat, roulette, admin_roulette, 
    shipping, addresses, cart, payment, crm, cashback, raw_materials
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(coupons.router, prefix="/coupons", tags=["coupons"])
app.include_router(carousel.router, prefix="/carousel", tags=["carousel"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
app.include_router(images.router, prefix="/images", tags=["images"])
app.include_router(news.router, prefix="/news", tags=["news"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(roulette.router, prefix="/roleta", tags=["roulette"])
app.include_router(admin_roulette.router, prefix="/admin/roleta", tags=["admin_roulette"])
app.include_router(shipping.router, prefix="/shipping", tags=["shipping"])
app.include_router(addresses.router, prefix="/addresses", tags=["addresses"])
app.include_router(cart.router, prefix="/cart", tags=["cart"])
app.include_router(payment.router, prefix="/payment", tags=["payment"])
app.include_router(crm.router, prefix="/crm", tags=["crm"])
app.include_router(cashback.router, tags=["cashback"])
app.include_router(raw_materials.router, prefix="/raw-materials", tags=["raw-materials"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
