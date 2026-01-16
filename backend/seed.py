from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models import models
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    
    # Create Admin
    admin = db.query(models.User).filter(models.User.email == "admin@ecosopis.com.br").first()
    if not admin:
        admin = models.User(
            email="admin@ecosopis.com.br",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Ecosopis",
            role="admin"
        )
        db.add(admin)

    # Create Initial Products
    products = [
        {
            "name": "Sérum Facial Antioxidante",
            "slug": "serum-facial-antioxidante",
            "description": "Sérum leve e potente com vitamina C e ativos naturais para uma pele radiante.",
            "ingredients": "Extrato de semente de uva, Vitamina C, Ácido Hialurônico vegetal.",
            "benefits": "Antioxidação, hidratação profunda, uniformização do tom da pele.",
            "price": 89.90,
            "stock": 50,
            "image_url": "https://acdn-us.mitiendanube.com/stores/003/178/794/products/serum-antioxidante-1-7d1f5e88888888888888.webp",
            "tags": ["antioxidante", "vitamina-c", "skin:oily", "skin:mixed", "acne", "facial"],
            "buy_on_site": True,
            "mercadolivre_url": "https://produto.mercadolivre.com.br/placeholder",
            "shopee_url": "https://shopee.com.br/placeholder"
        },
        {
            "name": "Creme Hidratante Revitalizante",
            "slug": "creme-hidratante-revitalizante",
            "description": "Hidratação intensa com textura não oleosa.",
            "ingredients": "Manteiga de Karité, Óleo de Argan, Aloe Vera.",
            "benefits": "Nutrição, maciez, barreira protetora.",
            "price": 65.00,
            "stock": 100,
            "image_url": "https://acdn-us.mitiendanube.com/stores/003/178/794/products/creme-revitalizante-1-7d1f5e99999999999999.webp",
            "tags": ["hidratante", "skin:dry", "skin:normal", "sensitivity", "vegano", "facial"],
            "buy_on_site": True,
            "mercadolivre_url": "https://produto.mercadolivre.com.br/placeholder",
            "shopee_url": None
        },
        {
            "name": "Shampoo Sólido Purificante",
            "slug": "shampoo-solido-purificante",
            "description": "Limpeza profunda sem agredir os fios.",
            "ingredients": "Argila Verde, Alecrim, Óleo de Hortelã.",
            "benefits": "Controle de oleosidade, frescor, sustentabilidade.",
            "price": 45.00,
            "stock": 80,
            "image_url": "https://acdn-us.mitiendanube.com/stores/003/178/794/products/shampoo-solido-1.webp",
            "tags": ["shampoo", "hair:oily", "purificante", "hair"],
            "buy_on_site": True,
            "mercadolivre_url": None,
            "shopee_url": None
        },
        {
            "name": "Máscara Capilar Nutritiva",
            "slug": "mascara-capilar-nutritiva",
            "description": "Nutrição profunda para cabelos secos e quebradiços.",
            "ingredients": "Óleo de Coco, Manteiga de Cupuaçu, Pantenol.",
            "benefits": "Brilho, maciez, restauração capilar.",
            "price": 72.00,
            "stock": 60,
            "image_url": "https://acdn-us.mitiendanube.com/stores/003/178/794/products/mascara-capilar-1.webp",
            "tags": ["mascara", "hair:dry", "hair:damaged", "hair"],
            "buy_on_site": True,
            "mercadolivre_url": None,
            "shopee_url": None
        }
    ]

    for p_data in products:
        db_product = db.query(models.Product).filter(models.Product.slug == p_data["slug"]).first()
        if not db_product:
            db_product = models.Product(**p_data)
            db.add(db_product)
    
    db.commit()
    db.close()
    print("Database seeded!")

if __name__ == "__main__":
    seed()
