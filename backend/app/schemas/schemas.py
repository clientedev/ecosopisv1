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
    total_compras: int = 0
    pode_girar_roleta: bool = False
    tentativas_roleta: int = 0
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
    payment_method: str # "mercadopago" (or legacy "pix"/"credit_card")
    shipping_method: Optional[str] = None
    shipping_price: Optional[float] = 0.0

class OrderResponse(BaseModel):
    id: int
    status: str
    total: float
    items: List[OrderItem]
    payment_url: Optional[str] = None
    pix_code: Optional[str] = None
    mp_preference_id: Optional[str] = None
    mp_payment_id: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    correios_label_url: Optional[str] = None
    shipping_method: Optional[str] = None
    shipping_price: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AdminOrderResponse(OrderResponse):
    address: Optional[Dict[str, Any]] = None

class PaymentStatusResponse(BaseModel):
    order_id: int
    status: str
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    total: float
    items: Optional[list] = None
    created_at: Optional[datetime] = None

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
    is_active: bool = True

# Product Details Schemas
class ProductDetailBase(BaseModel):
    curiosidades: Optional[str] = None
    modo_de_uso: Optional[str] = None
    ingredientes: Optional[str] = None
    cuidados: Optional[str] = None
    contraindicacoes: Optional[str] = None
    observacoes: Optional[str] = None

class ProductDetailCreate(ProductDetailBase):
    pass

class ProductDetailUpdate(ProductDetailBase):
    pass

class ProductDetailResponse(ProductDetailBase):
    id: int
    product_id: int
    slug: str
    qr_code_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProductCreate(ProductBase):
    details: Optional[ProductDetailCreate] = None
    origin: Optional[str] = None

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
    is_active: Optional[bool] = None

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
    alignment: Optional[str] = "left"
    vertical_alignment: Optional[str] = "center"
    content_max_width: Optional[str] = "500px"
    glassmorphism: Optional[bool] = False
    offset_x: Optional[str] = "0px"
    offset_y: Optional[str] = "0px"
    title_color: Optional[str] = "#ffffff"
    description_color: Optional[str] = "#ffffff"
    badge_color: Optional[str] = "#ffffff"
    badge_bg_color: Optional[str] = "#4a7c59"
    overlay_color: Optional[str] = "#000000"
    overlay_opacity: Optional[float] = 0.3
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
    details: Optional[ProductDetailResponse] = None

    class Config:
        from_attributes = True

# News Schemas
class NewsCommentResponse(BaseModel):
    id: int
    content: str
    user: UserResponse
    created_at: datetime

    class Config:
        from_attributes = True

class NewsBase(BaseModel):
    title: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = "image" # "image" or "video"

class NewsCreate(NewsBase):
    pass

class NewsResponse(NewsBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    user: Optional[UserResponse] = None
    likes_count: int = 0
    is_liked: bool = False
    comments: List[NewsCommentResponse] = []

    class Config:
        from_attributes = True

class NewsCommentCreate(BaseModel):
    content: str

# Metrics Schemas
class SiteVisitLog(BaseModel):
    path: str

class ProductClickLog(BaseModel):
    product_id: int
    click_type: str # "shopee", "mercadolivre", "site"

class MetricsSummary(BaseModel):
    total_visits: int
    total_clicks: int
    clicks_by_type: Dict[str, int]
    clicks_by_product: List[Dict[str, Any]]

# Roulette Schemas
class RouletteConfigBase(BaseModel):
    ativa: bool = False
    popup_ativo: bool = False
    regra_novo_usuario: bool = False
    regra_5_compras: bool = False

class RouletteConfigUpdate(BaseModel):
    ativa: Optional[bool] = None
    popup_ativo: Optional[bool] = None
    regra_novo_usuario: Optional[bool] = None
    regra_5_compras: Optional[bool] = None

class RouletteConfigResponse(RouletteConfigBase):
    id: int
    updated_at: datetime
    class Config:
        from_attributes = True

class RoulettePrizeBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ativo: bool = True
    selecionado_para_sair: bool = False
    quantidade_disponivel: Optional[int] = None
    discount_type: Optional[str] = None # percentage, fixed
    discount_value: Optional[float] = None

class RoulettePrizeCreate(RoulettePrizeBase):
    pass

class RoulettePrizeUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None
    selecionado_para_sair: Optional[bool] = None
    quantidade_disponivel: Optional[int] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None

class RoulettePrizeResponse(RoulettePrizeBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class RouletteSpinResponse(BaseModel):
    prize: RoulettePrizeResponse
    
class RouletteHistoryResponse(BaseModel):
    id: int
    usuario_id: int
    premio_id: int
    data_giro: datetime
    prize: RoulettePrizeResponse
    class Config:
        from_attributes = True

# Raw Materials Schemas
class RawMaterialResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
