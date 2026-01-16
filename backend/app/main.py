from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api.endpoints import auth, products, coupons

# Create database tables
Base.metadata.create_all(bind=engine)

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
