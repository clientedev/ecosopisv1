from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_ingredients():
    db = SessionLocal()
    
    updates = [
        {"slug": "desodorante-clareador-solido", "actives": "Argila Branca, Hidróxido de Magnésio, Manteiga de Karité - LIVRE de álcool e alumínio"},
    ]
    
    for upd in updates:
        p = db.query(Product).filter(Product.slug == upd['slug']).first()
        if p:
            print(f"Updating: {p.name} ({p.slug})")
            p.ingredients = upd['actives']
            if p.details:
                p.details.ingredientes = upd['actives']
            else:
                p.details = ProductDetail(
                    product_id=p.id,
                    slug=p.slug,
                    ingredientes=upd['actives']
                )
        else:
            print(f"NOT FOUND SLUG: {upd['slug']}")
            
    db.commit()
    print("Updates committed successfully.")
    db.close()

if __name__ == "__main__":
    update_ingredients()
