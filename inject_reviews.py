import os
import sys

# Add the backend directory to the path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import SessionLocal
from app.models.models import Product, Review

def inject_reviews():
    db = SessionLocal()

    try:
        products = db.query(Product).all()
        
        # We will add 2 positive reviews per product, or some generic ones.
        for product in products:
            # Check if product already has reviews
            existing_reviews = db.query(Review).filter(Review.product_id == product.id).count()
            if existing_reviews < 2:
                # Inject a few positive reviews
                reviews_to_add = [
                    Review(
                        product_id=product.id,
                        user_name="M***a Silva",
                        comment=f"Adorei o {product.name}! Superou minhas expectativas e tem um cheiro maravilhoso. Recomendo muito.",
                        rating=5,
                        is_approved=True
                    ),
                    Review(
                        product_id=product.id,
                        user_name="j***o Pedro",
                        comment="Produto de excelente qualidade. Entrega super rápida, veio bem embalado. Voltarei a comprar com certeza.",
                        rating=5,
                        is_approved=True
                    )
                ]
                db.bulk_save_objects(reviews_to_add)
                print(f"Added 2 reviews for {product.name}")
        
        db.commit()
        print("Successfully injected positive reviews.")
    except Exception as e:
        print(f"Error injecting reviews: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inject_reviews()
