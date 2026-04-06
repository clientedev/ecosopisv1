from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, JSON, DateTime, Text, LargeBinary, event
from sqlalchemy.orm import relationship, Session
from sqlalchemy.sql import func
from app.core.database import Base

class StoredImage(Base):
    __tablename__ = "stored_images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


def coerce_stored_image_content_type(target: "StoredImage") -> None:
    from app.core.upload_content_type import resolve_stored_image_content_type

    target.content_type = resolve_stored_image_content_type(
        filename=target.filename,
        declared=target.content_type,
    )


def _ensure_stored_image_content_type(mapper, connection, target):
    coerce_stored_image_content_type(target)


# Mapper hooks (cover normal ORM inserts)
event.listen(StoredImage, "before_insert", _ensure_stored_image_content_type, propagate=True)
event.listen(StoredImage, "before_update", _ensure_stored_image_content_type, propagate=True)


@event.listens_for(Session, "before_flush")
def _stored_image_coerce_on_flush(session, flush_context, instances) -> None:
    """Guarantee content_type before any INSERT/UPDATE hits the DB (Railway/Postgres)."""
    for obj in set(session.new).union(session.dirty):
        if isinstance(obj, StoredImage):
            coerce_stored_image_content_type(obj)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="client") # admin, client
    can_post_news = Column(Boolean, default=False)  # can post to blog/news
    
    # Roulette fields
    total_compras = Column(Integer, default=0)
    pode_girar_roleta = Column(Boolean, default=False)
    tentativas_roleta = Column(Integer, default=0)
    ultimo_premio_id = Column(Integer, ForeignKey("roulette_prizes.id"), nullable=True)
    
    profile_picture = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="user")
    roulette_history = relationship("RouletteHistory", back_populates="user")
    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")

class RouletteConfig(Base):
    __tablename__ = "roulette_config"

    id = Column(Integer, primary_key=True, index=True)
    ativa = Column(Boolean, default=False)
    popup_ativo = Column(Boolean, default=False)
    regra_novo_usuario = Column(Boolean, default=False)
    regra_5_compras = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class RoulettePrize(Base):
    __tablename__ = "roulette_prizes"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    descricao = Column(Text)
    ativo = Column(Boolean, default=True)
    selecionado_para_sair = Column(Boolean, default=False)
    quantidade_disponivel = Column(Integer, nullable=True) # Optional stock control
    
    # New coupon fields
    discount_type = Column(String, nullable=True) # percentage, fixed
    discount_value = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RouletteHistory(Base):
    __tablename__ = "roulette_history"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("users.id"))
    premio_id = Column(Integer, ForeignKey("roulette_prizes.id"))
    data_giro = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="roulette_history")
    prize = relationship("RoulettePrize")

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
    is_wholesale = Column(Boolean, default=False)
    mercadolivre_url = Column(String, nullable=True)
    shopee_url = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")
    details = relationship("ProductDetail", back_populates="product", uselist=False, cascade="all, delete-orphan")

class ProductDetail(Base):
    __tablename__ = "product_details"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False) # Permanent and immutable
    
    curiosidades = Column(Text, nullable=True)
    modo_de_uso = Column(Text, nullable=True)
    ingredientes = Column(Text, nullable=True)
    cuidados = Column(Text, nullable=True)
    contraindicacoes = Column(Text, nullable=True)
    observacoes = Column(Text, nullable=True)
    
    qr_code_path = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    product = relationship("Product", back_populates="details")

class CarouselItem(Base):
    __tablename__ = "carousel_items"

    id = Column(Integer, primary_key=True, index=True)
    badge = Column(String)
    title = Column(String)
    description = Column(Text)
    image_url = Column(String)
    cta_primary_text = Column(String)
    cta_primary_link = Column(String)
    cta_secondary_text = Column(String)
    cta_secondary_link = Column(String)
    order = Column(Integer, default=0)
    
    # Customization fields
    alignment = Column(String, default="left") # left, center, right
    vertical_alignment = Column(String, default="center") # top, center, bottom
    content_max_width = Column(String, default="500px")
    glassmorphism = Column(Boolean, default=False)
    offset_x = Column(String, default="0px")
    offset_y = Column(String, default="0px")
    title_color = Column(String, default="#ffffff")
    description_color = Column(String, default="#ffffff")
    badge_color = Column(String, default="#ffffff")
    badge_bg_color = Column(String, default="#4a7c59")
    overlay_color = Column(String, default="#000000")
    overlay_opacity = Column(Float, default=0.3)
    mobile_image_url = Column(String, nullable=True)
    carousel_height = Column(String, default="600px")
    mobile_carousel_height = Column(String, default="400px")
    image_fit = Column(String, default="cover")

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
    payment_method = Column(String, default="stripe")
    shipping_method = Column(String, nullable=True)
    shipping_price = Column(Float, default=0.0)
    # Stripe fields
    stripe_payment_id = Column(String, nullable=True)
    stripe_session_id = Column(String, nullable=True)
    # Customer info for shipping label
    customer_name = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    coupon_code = Column(String, nullable=True)
    discount_amount = Column(Float, default=0.0)
    # Buyer info from Stripe webhook (customer_details)
    buyer_name = Column(String, nullable=True)
    buyer_email = Column(String, nullable=True)
    # Correios/Melhor Envio
    correios_label_url = Column(String, nullable=True)
    codigo_rastreio = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="order_items")
    product = relationship("Product")

    @property
    def product_name(self) -> str:
        return self.product.name if self.product else "Produto Excluído"

class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=True) # E.g. "Work", "Home"
    street = Column(String, nullable=False)
    number = Column(String, nullable=False)
    complement = Column(String, nullable=True)
    neighborhood = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    postal_code = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="addresses")

class AnnouncementBar(Base):
    __tablename__ = "announcement_bar"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)
    bg_color = Column(String, default="#2d5a27")
    text_color = Column(String, default="#ffffff")
    is_active = Column(Boolean, default=True)
    is_scrolling = Column(Boolean, default=False)
    repeat_text = Column(Boolean, default=True)
    scroll_speed = Column(Integer, default=20)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_name = Column(String, nullable=False) # e.g. "Essencial", "Premium", "Vip"
    status = Column(String, default="active") # active, paused, cancelled
    shipping_status = Column(String, default="pending") # pending, preparing, shipped, delivered
    next_billing_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    user_name = Column(String, nullable=False)
    comment = Column(Text, nullable=False)
    rating = Column(Integer, default=5)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="reviews")

Product.reviews = relationship("Review", back_populates="product")

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class Coupon(Base):
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

class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    media_url = Column(String) # Image or Video URL
    media_type = Column(String) # "image" or "video"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    likes = relationship("NewsLike", back_populates="news", cascade="all, delete-orphan")
    comments = relationship("NewsComment", back_populates="news", cascade="all, delete-orphan")

class NewsLike(Base):
    __tablename__ = "news_likes"
    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, ForeignKey("news.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    news = relationship("News", back_populates="likes")
    user = relationship("User")

class NewsComment(Base):
    __tablename__ = "news_comments"
    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, ForeignKey("news.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    news = relationship("News", back_populates="comments")
    user = relationship("User")

class SiteVisit(Base):
    __tablename__ = "site_visits"
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProductClick(Base):
    __tablename__ = "product_clicks"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    click_type = Column(String) # "shopee", "mercadolivre", "site"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    product = relationship("Product")

class RawMaterial(Base):
    __tablename__ = "raw_materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
