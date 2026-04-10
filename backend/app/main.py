from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import engine, Base, get_db
import traceback
import logging
from app.core.database import SessionLocal
from app.models import models

# Initialize logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def _apply_startup_migrations():
    import bcrypt as _bcrypt

    CAROUSEL_COLS = [
        ("alignment",              "VARCHAR DEFAULT 'left'"),
        ("title_color",            "VARCHAR DEFAULT '#ffffff'"),
        ("description_color",      "VARCHAR DEFAULT '#ffffff'"),
        ("badge_color",            "VARCHAR DEFAULT '#ffffff'"),
        ("badge_bg_color",         "VARCHAR DEFAULT '#4a7c59'"),
        ("overlay_color",          "VARCHAR DEFAULT '#000000'"),
        ("overlay_opacity",        "DOUBLE PRECISION DEFAULT 0.3"),
        ("vertical_alignment",     "VARCHAR DEFAULT 'center'"),
        ("content_max_width",      "VARCHAR DEFAULT '500px'"),
        ("glassmorphism",          "BOOLEAN DEFAULT FALSE"),
        ("offset_x",               "VARCHAR DEFAULT '0px'"),
        ("offset_y",               "VARCHAR DEFAULT '0px'"),
        ("mobile_image_url",       "VARCHAR"),
        ("carousel_height",        "VARCHAR DEFAULT '700px'"),
        ("mobile_carousel_height", "VARCHAR DEFAULT '400px'"),
        ("image_fit",              "VARCHAR DEFAULT 'cover'"),
        ("is_active",              "BOOLEAN DEFAULT TRUE"),
    ]
    ANNOUNCEMENT_COLS = [
        ("is_scrolling", "BOOLEAN DEFAULT FALSE"),
        ("repeat_text",  "BOOLEAN DEFAULT TRUE"),
        ("scroll_speed", "INTEGER DEFAULT 20"),
    ]
    NEWS_COLS = [
        ("media_url", "VARCHAR"),
        ("media_type", "VARCHAR"),
    ]
    USER_COLS = [
        ("can_post_news",      "BOOLEAN DEFAULT FALSE"),
        ("total_compras",      "INTEGER DEFAULT 0"),
        ("pode_girar_roleta",  "BOOLEAN DEFAULT FALSE"),
        ("tentativas_roleta",  "INTEGER DEFAULT 0"),
        ("ultimo_premio_id",   "INTEGER"),
        ("profile_picture",    "VARCHAR"),
        ("is_verified",        "BOOLEAN DEFAULT FALSE"),
        ("verification_token", "VARCHAR"),
        ("cart_json",          "TEXT"),
        ("cart_updated_at",    "TIMESTAMP WITH TIME ZONE")
    ]
    PRIZE_COLS = [
        ("discount_type", "VARCHAR"),
        ("discount_value", "DOUBLE PRECISION")
    ]
    ORDER_COLS = [
        ("payment_method",      "VARCHAR DEFAULT 'stripe'"),
        ("shipping_method",     "VARCHAR"),
        ("shipping_price",      "REAL DEFAULT 0"),
        ("stripe_payment_id",   "VARCHAR"),
        ("stripe_session_id",   "VARCHAR"),
        ("customer_name",       "VARCHAR"),
        ("customer_email",      "VARCHAR"),
        ("customer_phone",      "VARCHAR"),
        ("customer_cpf",        "VARCHAR"),
        ("coupon_code",         "VARCHAR"),
        ("discount_amount",     "REAL DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for col, defn in ORDER_COLS:
            try:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
                logger.info(f"✓ Column orders.{col} ensured.")
            except Exception as e:
                logger.warning(f"Failed to ensure orders.{col}: {e}")
                conn.rollback()

        for col, defn in CAROUSEL_COLS:
            try:
                conn.execute(text(f"ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
                logger.info(f"✓ Column carousel_items.{col} ensured.")
            except Exception as e:
                logger.warning(f"Failed to ensure carousel_items.{col}: {e}")
                conn.rollback()

        for col, defn in ANNOUNCEMENT_COLS:
            try:
                conn.execute(text(f"ALTER TABLE announcement_bar ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
                logger.info(f"✓ Column announcement_bar.{col} ensured.")
            except Exception as e:
                logger.warning(f"Failed to ensure announcement_bar.{col}: {e}")
                conn.rollback()

        for col, defn in NEWS_COLS:
            try:
                conn.execute(text(f"ALTER TABLE news ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
                logger.info(f"✓ Column news.{col} ensured.")
            except Exception as e:
                logger.warning(f"Failed to ensure news.{col}: {e}")
                conn.rollback()

        for col, defn in USER_COLS:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
                logger.info(f"✓ Column users.{col} ensured.")
            except Exception as e:
                logger.warning(f"Failed to ensure users.{col}: {e}")
                conn.rollback()

        # Migration: Mark existing users as verified if they don't have a token yet
        try:
            conn.execute(text("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL OR (is_verified = FALSE AND verification_token IS NULL)"))
            conn.commit()
        except Exception as e:
            logger.warning(f"Could not update user verification status: {e}")

        for col, defn in PRIZE_COLS:
            try:
                conn.execute(text(f"ALTER TABLE roulette_prizes ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass

        # Add is_active to products if missing
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"))
            conn.commit()
        except Exception: pass

        # Add Stripe + Correios + Melhor Envio fields to orders
        ORDER_COLS = [
            ("shipping_method",    "VARCHAR"),
            ("shipping_price",     "DOUBLE PRECISION DEFAULT 0"),
            ("stripe_payment_id",  "VARCHAR"),
            ("stripe_session_id",  "VARCHAR"),
            ("buyer_name",         "VARCHAR"),
            ("buyer_email",        "VARCHAR"),
            ("correios_label_url", "VARCHAR"),
            ("etiqueta_url",       "VARCHAR"),
            ("codigo_rastreio",    "VARCHAR"),
            ("shipment_id",        "VARCHAR"),
        ]
        for col, defn in ORDER_COLS:
            try:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass

        # Create raw_materials table if missing
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS raw_materials (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR UNIQUE NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.commit()
        except Exception: pass

        # Ensure admin user exists
        try:
            row = conn.execute(text("SELECT id FROM users WHERE email='admin@admin.com'")).fetchone()
            if not row:
                pw = _bcrypt.hashpw(b"admin123", _bcrypt.gensalt()).decode("utf-8")
                conn.execute(text(
                    "INSERT INTO users (email, hashed_password, full_name, role, created_at) "
                    "VALUES (:e, :p, 'Admin Principal', 'admin', NOW())"
                ), {"e": "admin@admin.com", "p": pw})
                conn.commit()
        except Exception: pass

        # ── Cashback tables ────────────────────────────────────────────────────
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS cashback_config (
                    id SERIAL PRIMARY KEY,
                    is_active BOOLEAN DEFAULT TRUE,
                    first_purchase_percentage DOUBLE PRECISION DEFAULT 10.0,
                    repurchase_percentage DOUBLE PRECISION DEFAULT 10.0,
                    first_purchase_validity_days INTEGER DEFAULT 30,
                    repurchase_validity_days INTEGER DEFAULT 30,
                    min_purchase_to_earn DOUBLE PRECISION DEFAULT 0.0,
                    min_purchase_to_use DOUBLE PRECISION DEFAULT 50.0,
                    allow_with_coupons BOOLEAN DEFAULT FALSE,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.commit()
        except Exception: pass

        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS cashback_transactions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    order_id INTEGER REFERENCES orders(id),
                    amount DOUBLE PRECISION NOT NULL,
                    type VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'approved',
                    description VARCHAR,
                    is_first_purchase BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.commit()
        except Exception: pass

        # Ensure default cashback config singleton exists
        try:
            row = conn.execute(text("SELECT id FROM cashback_config LIMIT 1")).fetchone()
            if not row:
                conn.execute(text("""
                    INSERT INTO cashback_config
                        (is_active, first_purchase_percentage, repurchase_percentage,
                         first_purchase_validity_days, repurchase_validity_days,
                         min_purchase_to_earn, min_purchase_to_use, allow_with_coupons)
                    VALUES (TRUE, 10.0, 10.0, 30, 30, 0.0, 50.0, FALSE)
                """))
                conn.commit()
        except Exception: pass

try:
    logger.info("Starting startup migrations...")
    _apply_startup_migrations()
    logger.info("Startup migrations completed.")
except Exception as e:
    logger.error(f"FATAL STARTUP MIGRATION ERROR: {e}", exc_info=True)

from app.api.endpoints import auth, products, coupons, carousel, orders, settings, reviews, images, news, metrics, chat, roulette, admin_roulette, shipping, addresses, cart, payment, crm, cashback, raw_materials
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

load_dotenv()

import stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
stripe.api_version = "2024-04-10"


# Create database tables
Base.metadata.create_all(bind=engine)

# Routers included below...


app = FastAPI(title="ECOSOPIS API", version="1.0.0")

# Ensure static directory exists
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/qrcodes", exist_ok=True)
os.makedirs("static/labels", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log details locally
    stack = traceback.format_exc()
    logger.error(f"GLOBAL ERROR: {str(exc)}\n{stack}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Erro interno: {str(exc)}",
            "type": type(exc).__name__,
            "path": request.url.path
        }
    )

@app.middleware("http")
async def fix_proto_header(request, call_next):
    # If we're behind a proxy (like Next.js rewrite or Railway edge),
    # respect the X-Forwarded-Proto header to ensure redirects and
    # URL generation use the correct protocol (HTTPS).
    if request.headers.get("x-forwarded-proto") == "https":
        request.scope["scheme"] = "https"
    response = await call_next(request)
    return response

@app.get("/")
async def root():
    return {"message": "Welcome to ECOSOPIS API", "version": "1.0.1"}

@app.get("/diagnostic")
async def diagnostic(db: Session = Depends(get_db)):
    status = {
        "database": "OK",
        "env": {},
        "missing_columns": {}
    }
    try:
        # Check tables
        tables = ["users", "orders", "products"]
        for table in tables:
            try:
                cols = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'")).fetchall()
                status["env"][f"{table}_columns"] = [c[0] for c in cols]
            except Exception as e:
                status["database"] = f"ERROR on {table}: {str(e)}"
        
        # Check critical env vars
        status["env"]["STRIPE_KEY"] = "SET" if os.getenv("STRIPE_SECRET_KEY") else "MISSING"
        status["env"]["MP_TOKEN"] = "SET" if os.getenv("MP_ACCESS_TOKEN") else "MISSING"
        status["env"]["FRONTEND_URL"] = os.getenv("FRONTEND_URL", "NOT_SET")
        
    except Exception as e:
        status["database"] = f"GENERAL ERROR: {str(e)}"
    
    return status

from app.api.endpoints import auth, products, coupons, carousel, orders, settings, reviews, images, news, metrics, chat, roulette, admin_roulette, shipping, addresses, cart, payment, crm, cashback, raw_materials
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

# Novos routers com Arquitetura Limpa (Routes/Services/Repositories)
try:
    from app.routes import checkout, freight
    # app.include_router(checkout.router, prefix="/payment", tags=["checkout_v2"])
    app.include_router(freight.router, tags=["freight_v2"])
except ImportError as e:
    print(f"Skipping v2 routes import: {e}")

# Melhor Envio — envio automático e webhook
try:
    from app.routes import envio, webhook_me
    app.include_router(envio.router, tags=["envio"])
    app.include_router(webhook_me.router, tags=["webhook"])
except ImportError as e:
    print(f"Skipping envio/webhook routes: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
