from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
# Run migrations before potentially importing any routers that might trigger SQLAlchemy mapping errors
def _apply_startup_migrations():
    from sqlalchemy import text
    import bcrypt as _bcrypt

    CAROUSEL_COLS = [
        ("alignment",         "VARCHAR DEFAULT 'left'"),
        ("title_color",       "VARCHAR DEFAULT '#ffffff'"),
        ("description_color", "VARCHAR DEFAULT '#ffffff'"),
        ("badge_color",       "VARCHAR DEFAULT '#ffffff'"),
        ("badge_bg_color",    "VARCHAR DEFAULT '#4a7c59'"),
        ("overlay_color",     "VARCHAR DEFAULT '#000000'"),
        ("overlay_opacity",   "DOUBLE PRECISION DEFAULT 0.3"),
        ("vertical_alignment", "VARCHAR DEFAULT 'center'"),
        ("content_max_width", "VARCHAR DEFAULT '500px'"),
        ("glassmorphism",     "BOOLEAN DEFAULT FALSE"),
        ("offset_x",          "VARCHAR DEFAULT '0px'"),
        ("offset_y",          "VARCHAR DEFAULT '0px'"),
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
        ("profile_picture",    "VARCHAR")
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
        ("coupon_code",         "VARCHAR"),
        ("discount_amount",     "REAL DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for col, defn in ORDER_COLS:
            try:
                # Use ALTER TABLE ADD COLUMN IF NOT EXISTS syntax (works in newer SQLite and Postgres)
                # For older SQLite, we might need a different check, but this is the current pattern.
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass
        for col, defn in CAROUSEL_COLS:
            try:
                conn.execute(text(f"ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass

        for col, defn in ANNOUNCEMENT_COLS:
            try:
                conn.execute(text(f"ALTER TABLE announcement_bar ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass

        for col, defn in NEWS_COLS:
            try:
                conn.execute(text(f"ALTER TABLE news ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass

        for col, defn in USER_COLS:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {defn}"))
                conn.commit()
            except Exception: pass

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

        # Add Stripe + Correios fields to orders
        ORDER_COLS = [
            ("shipping_method",    "VARCHAR"),
            ("shipping_price",     "DOUBLE PRECISION DEFAULT 0"),
            ("stripe_payment_id",  "VARCHAR"),
            ("stripe_session_id",  "VARCHAR"),
            ("buyer_name",         "VARCHAR"),
            ("buyer_email",        "VARCHAR"),
            ("correios_label_url", "VARCHAR"),
            ("codigo_rastreio",    "VARCHAR"),
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

try:
    _apply_startup_migrations()
except Exception: pass

from app.api.endpoints import auth, products, coupons, carousel, orders, settings, reviews, images, news, metrics, chat, roulette, admin_roulette, shipping, addresses
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

load_dotenv()

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

from app.api.endpoints import raw_materials
from app.api.endpoints import payment, shipping, crm
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
app.include_router(raw_materials.router, prefix="/raw-materials", tags=["raw-materials"])
app.include_router(payment.router, prefix="/payment", tags=["payment"])
app.include_router(shipping.router, prefix="/shipping", tags=["shipping"])
app.include_router(crm.router, prefix="/crm", tags=["crm"])
app.include_router(addresses.router, prefix="/addresses", tags=["addresses"])

# Novos routers com Arquitetura Limpa (Routes/Services/Repositories)
try:
    from app.routes import checkout, freight
    app.include_router(checkout.router, prefix="/payment", tags=["checkout_v2"])
    app.include_router(freight.router, tags=["freight_v2"])
except ImportError as e:
    print(f"Skipping v2 routes import: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
