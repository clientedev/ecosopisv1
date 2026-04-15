from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_ingredients():
    db = SessionLocal()
    
    updates = [
        # Sabonetes
        {"slug": "sabonete-acafrao", "actives": "Açafrão, Dolomita, Barbatimão"},
        {"slug": "sabonete-clareador", "actives": "Argila Branca, Dolomita, Aloe Vera"},
        {"slug": "sabonete-argila-verde", "actives": "Argila Verde, Aloe Vera, Óleo de Semente de Uva"},
        {"slug": "sabonete-carvao-ativado", "actives": "Carvão Ativado, Calêndula, Aloe Vera"},
        {"slug": "sabonete-rosa-mosqueta-argila-rosa", "actives": "Rosa Mosqueta, Argila Rosa"},
        {"slug": "sabonete-intimo-barbatimo", "actives": "Barbatimão, Calêndula"},
        
        # Óleos Vegetais
        {"slug": "oleo-rosa-mosqueta-puro", "actives": "Oleo vegetal de Rosa Mosqueta Rubiginosa (Rosehip Fruit Oil) 100% puro"},
        {"slug": "oleo-rosa-mosqueta-20ml", "actives": "Oleo vegetal de rosa mosqueta canina (Rosa Canina Fruit Oil) 100% puro"},
        {"slug": "oleo-alecrim", "actives": "Oleo vegetal de alecrim (Rosmarinus Officinalis Leaf Oil) 100% puro"},
        {"slug": "oleo-abacate", "actives": "Oleo vegetal de abacate (Persea Gratissima Oil) 100% puro"},
        {"slug": "oleo-semente-uva", "actives": "Oleo vegetal de semente de uva (Grape Seed Oil) 100% puro"},
        {"slug": "oleo-ricino", "actives": "Oleo vegetal de rícino (Ricinus Communis Seed Oil) 100% puro"},
        {"slug": "oleo-argan", "actives": "Oleo vegetal de Argan (Argania Spinosa Kernel Oil) 100% puro"},
        
        # Óleos Essenciais
        {"slug": "oe-lavanda", "actives": "Oleo essencial de lavanda francesa (Lavandula Officinalis Oil) 100% puro"},
        {"slug": "oe-melaleuca", "actives": "Oleo essencial de melaleuca (Melaleuca Alternifolia Leaf Oil) 100% puro"},
        {"slug": "oe-menta", "actives": "Oleo essencial de Menta Piperita (Mentha Piperita Oil) 100% puro"},
        {"slug": "oe-laranja", "actives": "óleo essencial de laranja doce (Citrus Aurantium Dulcis Peel Oil) 100% puro"},
        
        # Cremes e Outros
        {"slug": "tonico-facial-antioxidante", "actives": "Lavanda, Aloe Vera, Pepino"},
        {"slug": "creme-oleosidade-acne", "actives": "Calêndula, Chá Verde, Óleo de Semente de Uva, Vitamina E"},
        {"slug": "creme-pes-de-anjo", "actives": "Barbatimão, Aloe Vera, Copaíba, Ureia"},
        {"slug": "desodorante-solido", "actives": "Argila Branca, Hidróxido de Magnésio, Manteiga de Karité - LIVRE de álcool e alumínio"},
        {"slug": "manteiga-ojon", "actives": "Manteiga de Ojon Hidrolisada"},
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
