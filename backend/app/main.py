from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api.endpoints import auth, products, coupons, carousel, orders, settings, reviews, images, news, metrics, chat
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

# ── Startup migration: add columns that exist in models but not in the live DB ──
# Uses IF NOT EXISTS so this is 100% safe to run on every startup.
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
    ]
    with engine.connect() as conn:
        for col, defn in CAROUSEL_COLS:
            try:
                conn.execute(text(
                    f"ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS {col} {defn}"
                ))
                conn.commit()
            except Exception:
                try: conn.rollback()
                except Exception: pass

        # Add can_post_news to users if missing
        try:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_news BOOLEAN DEFAULT FALSE"
            ))
            conn.commit()
        except Exception:
            try: conn.rollback()
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
                print("✓ Admin user created: admin@admin.com / admin123")
        except Exception as e:
            try: conn.rollback()
            except Exception: pass
            print(f"Admin check skipped: {e}")

try:
    _apply_startup_migrations()
    print("✓ Startup migrations complete.")
except Exception as e:
    print(f"Startup migration error (non-fatal): {e}")


app = FastAPI(title="ECOSOPIS API", version="1.0.0")

# Ensure static directory exists
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to ECOSOPIS API"}

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
