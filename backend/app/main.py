from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api.endpoints import auth, products, coupons, carousel, orders, settings, reviews, images

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed database
import subprocess
import sys

def run_seed():
    try:
        print("Running database seed...")
        subprocess.run([sys.executable, "seed.py"], check=True)
    except Exception as e:
        print(f"Error seeding database: {e}")

run_seed()

from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="ECOSOPIS API", version="1.0.0")

# Ensure static directory exists
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific domain
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
