from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_kit_acne():
    db = SessionLocal()
    try:
        slug = "kit-acne"
        modo_de_uso = (
            "1. Sabonete de Argila Verde: utilizar diariamente para limpeza da pele, aplicando sobre a pele úmida, massageando suavemente e enxaguando.\n\n"
            "2. Sabonete de Carvão Ativado & Calêndula: pode ser usado diariamente, alternando com o sabonete de argila verde, ou conforme necessidade para uma limpeza mais profunda.\n\n"
            "3. Creme Facial Anti Oleosidade: após a limpeza, aplicar uma pequena quantidade no rosto limpo e seco, espalhando até completa absorção. Usar diariamente.\n\n"
            "Sugestão de uso: utilizar os sabonetes pela manhã e à noite, finalizando com o creme facial para melhores resultados no controle da acne e da oleosidade."
        )
        
        product = db.query(Product).filter(Product.slug == slug).first()
        if product:
            print(f"Updating {product.name}...")
            details = db.query(ProductDetail).filter(ProductDetail.product_id == product.id).first()
            if not details:
                details = ProductDetail(product_id=product.id, slug=product.slug)
                db.add(details)
            
            details.modo_de_uso = modo_de_uso
            db.commit()
            print("Success! Kit Acne usage updated.")
        else:
            print("Product kit-acne not found.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_kit_acne()
