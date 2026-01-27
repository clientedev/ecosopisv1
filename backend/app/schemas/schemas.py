from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any, Dict
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

class OrderCreate(BaseModel):
    items: List[OrderItem]
    total: float
    address: Dict[str, Any]
    payment_method: str # "pix" or "credit_card"
    shipping_method: Optional[str] = None
    shipping_price: Optional[float] = 0.0

class OrderResponse(BaseModel):
    id: int
    status: str
    total: float
    items: List[OrderItem]
    payment_url: Optional[str] = None
    pix_code: Optional[str] = None
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

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[str] = None
    benefits: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    buy_on_site: Optional[bool] = None
    mercadolivre_url: Optional[str] = None
    shopee_url: Optional[str] = None

# Carousel Schemas
class CarouselItemBase(BaseModel):
    badge: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    cta_primary_text: Optional[str] = None
    cta_primary_link: Optional[str] = None
    cta_secondary_text: Optional[str] = None
    cta_secondary_link: Optional[str] = None
    order: int = 0
    is_active: bool = True

class CarouselItemCreate(CarouselItemBase):
    pass

class CarouselItemResponse(CarouselItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# News Schemas
class NewsBase(BaseModel):
    title: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = "image" # "image" or "video"

class NewsCreate(NewsBase):
    pass

class NewsResponse(NewsBase):
    id: int
    user_id: int
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True
