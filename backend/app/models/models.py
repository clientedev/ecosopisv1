from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="client") # admin, client
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="user")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    ingredients = Column(Text)
    benefits = Column(Text)
    price = Column(Float)
    stock = Column(Integer, default=0)
    image_url = Column(String)
    images = Column(JSON, default=list) # List of image URLs
    tags = Column(JSON) # e.g. ["skin:oily", "acne", "vegan"]
    
    # Buy channels
    buy_on_site = Column(Boolean, default=True)
    mercadolivre_url = Column(String, nullable=True)
    shopee_url = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending") # pending, paid, shipped, delivered, cancelled
    total = Column(Float)
    address = Column(JSON) # Shipping address
    items = Column(JSON) # List of product IDs and quantities
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="orders")

class Coupon(BaseBase):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    discount_type = Column(String, nullable=False) # percentage, fixed
    discount_value = Column(Float, nullable=False)
    min_purchase_value = Column(Float, default=0)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
