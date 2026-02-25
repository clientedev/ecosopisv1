from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import models

def check_products():
    db = SessionLocal()
    try:
        products = db.query(models.Product).all()
        print(f"Total products: {len(products)}")
        for p in products:
            details = db.query(models.ProductDetail).filter(models.ProductDetail.product_id == p.id).first()
            print(f"Product: {p.name} (ID: {p.id}, Slug: {p.slug}) - Details: {'Found' if details else 'Missing'}")
            if details:
                print(f"  QR Path: {details.qr_code_path}")
    finally:
        db.close()

if __name__ == "__main__":
    check_products()
