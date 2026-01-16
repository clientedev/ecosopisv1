from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime

# Auth Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class OrderItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float

class OrderResponse(BaseModel):
    id: int
    status: str
    total: float
    items: List[OrderItem]
    created_at: datetime

    class Config:
        from_attributes = True

class UserProfileResponse(UserResponse):
    orders: List[OrderResponse] = []

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

# Coupon Schemas
class CouponBase(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    min_purchase_value: float = 0
    valid_until: Optional[datetime] = None
    is_active: bool = True
    usage_limit: Optional[int] = None

class CouponCreate(CouponBase):
    pass

class CouponUpdate(BaseModel):
    is_active: Optional[bool] = None
    usage_limit: Optional[int] = None
    valid_until: Optional[datetime] = None

class CouponResponse(CouponBase):
    id: int
    usage_count: int
    created_at: datetime

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    ingredients: Optional[str] = None
    benefits: Optional[str] = None
    price: Optional[float] = None
    stock: int = 0
    image_url: Optional[str] = None
    images: List[str] = []
    tags: List[str] = []
    buy_on_site: bool = True
    mercadolivre_url: Optional[str] = None
    shopee_url: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    name: Optional[str] = None
    slug: Optional[str] = None

class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
