import json
from app.core.database import SessionLocal
from app.models.models import Product

def map_products():
    db = SessionLocal()
    targets = [
        "Açafrão & Dolomita", "Clareador", "Argila Verde", "Carvão Ativado", 
        "Rosa Mosqueta & Argila Rosa", "Íntimo de Barbatimão", 
        "Rosa Mosqueta Rubiginosa", "Rosa Mosqueta Canina", "Alecrim", 
        "Abacate 20ml", "Semente de Uva 20ml", "Rícino 20ml", "Argan", 
        "Lavanda Francesa", "Melaleuca", "Menta Piperita", "Laranja Doce", 
        "Tônico Facial", "Creme Facial Anti Oleosidade", "Creme Pés de Anjo", 
        "Desodorante Natural", "Manteiga de Ojon"
    ]
    
    found = []
    for t in targets:
        # Search in name or slug
        p = db.query(Product).filter(Product.name.ilike(f"%{t}%")).first()
        if p:
            found.append({
                "target": t,
                "db_name": p.name,
                "db_slug": p.slug,
                "db_id": p.id
            })
        else:
            found.append({
                "target": t,
                "status": "NOT FOUND"
            })
            
    print(json.dumps(found, indent=2))
    db.close()

if __name__ == "__main__":
    map_products()
