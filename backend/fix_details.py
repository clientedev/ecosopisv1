import os
import qrcode
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import models
from app.api.endpoints.products import generate_qr_code

def fix_missing_details():
    db = SessionLocal()
    try:
        # Ensure static/qrcodes directory exists
        os.makedirs("static/qrcodes", exist_ok=True)
        
        products = db.query(models.Product).all()
        print(f"Total products to check: {len(products)}")
        
        count = 0
        for p in products:
            details = db.query(models.ProductDetail).filter(models.ProductDetail.product_id == p.id).first()
            if not details:
                print(f"Fixing Product: {p.name} (ID: {p.id})")
                
                # Generate QR code
                qr_path = generate_qr_code(p.slug)
                
                # Create mandatory details
                db_details = models.ProductDetail(
                    product_id=p.id,
                    slug=p.slug,
                    qr_code_path=qr_path
                )
                db.add(db_details)
                count += 1
        
        db.commit()
        print(f"Successfully created {count} missing detail records.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_missing_details()
