from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_soaps():
    db = SessionLocal()
    try:
        updates = {
            "sabonete-acafrao-dolomita": {
                "name": "Sabonete de Açafrão & Dolomita",
                "modo": "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário."
            },
            "sabonete-clareador-argila-branca": {
                "name": "Sabonete Super Clareador",
                "modo": "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário."
            },
            "sabonete-argila-verde": {
                "name": "Sabonete de Argila Verde",
                "modo": "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Pode ser usado diariamente, principalmente em peles oleosas."
            },
            "sabonete-carvao-ativado": {
                "name": "Sabonete de Carvão Ativado",
                "modo": "Aplicar sobre a pele úmida, massagear suavemente, focando nas áreas mais oleosas e enxaguar. Uso diário."
            },
            "sabonete-rosa-mosqueta-argila-rosa": {
                "name": "Sabonete de Rosa Mosqueta & Argila Rosa",
                "modo": "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Indicado para uso diário."
            },
            "sabonete-intimo-barbatimao": {
                "name": "Sabonete Íntimo de Barbatimão & Calêndula",
                "modo": "Aplicar na região externa íntima durante o banho, massagear suavemente e enxaguar bem. Uso diário."
            }
        }

        for slug, data in updates.items():
            product = db.query(Product).filter(Product.slug == slug).first()
            if product:
                print(f"Updating {slug}...")
                product.name = data["name"]
                
                details = db.query(ProductDetail).filter(ProductDetail.product_id == product.id).first()
                if not details:
                    details = ProductDetail(product_id=product.id, slug=product.slug)
                    db.add(details)
                
                details.modo_de_uso = data["modo"]
                # Also ensure ingredients/benefits are matching if needed, but the user only asked for "Modo de uso"
        
        db.commit()
        print("Success! All soaps updated.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_soaps()
