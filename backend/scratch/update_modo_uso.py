from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_modo_uso():
    db = SessionLocal()

    updates = [
        # Sabonetes
        {
            "slug": "sabonete-acafrao",
            "modo": "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário."
        },
        {
            "slug": "sabonete-clareador",
            "modo": "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário."
        },
        {
            "slug": "sabonete-argila-verde",
            "modo": "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Pode ser usado diariamente, principalmente em peles oleosas."
        },
        {
            "slug": "sabonete-carvao-ativado",
            "modo": "Aplicar sobre a pele úmida, massagear suavemente, focando nas áreas mais oleosas e enxaguar. Uso diário."
        },
        {
            "slug": "sabonete-rosa-mosqueta-argila-rosa",
            "modo": "Aplicar sobre a pele úmida, massagear suavemente e enxaguar. Indicado para uso diário."
        },
        {
            "slug": "sabonete-intimo-barbatimo",
            "modo": "Aplicar na região externa íntima durante o banho, massagear suavemente e enxaguar bem. Uso diário."
        },
        
        # Outros Produtos
        {
            "slug": "tonico-facial-antioxidante",
            "modo": "Aplicar com algodão ou diretamente no rosto limpo, espalhando suavemente. Não enxaguar."
        },
        {
            "slug": "creme-oleosidade-acne",
            "modo": "Aplicar uma pequena quantidade no rosto limpo e seco, espalhando até absorção. Uso diário."
        },
        {
            "slug": "creme-pes-de-anjo",
            "modo": "Aplicar nos pés limpos, massageando até completa absorção. Pode ser usado diariamente."
        },
        {
            "slug": "desodorante-clareador-solido",
            "modo": "Aplicar uma pequena quantidade nas axilas limpas e secas, espalhando uniformemente. Uso diário."
        },
        {
            "slug": "manteiga-ojon",
            "modo": "Aplicar pequena quantidade nos cabelos ou na pele, massageando bem. Para cabelos, pode ser usada como máscara."
        }
    ]
    
    print("--- Atualizando Modos de Uso ---")
    for upd in updates:
        slug = upd["slug"]
        modo = upd["modo"]
        
        p = db.query(Product).filter(Product.slug == slug).first()
        if p:
            print(f"Updating Modo de Uso: {p.name} ({p.slug})")
            if p.details:
                p.details.modo_de_uso = modo
            else:
                p.details = ProductDetail(product_id=p.id, slug=p.slug, modo_de_uso=modo)
        else:
            print(f"NOT FOUND SLUG: {slug}")

    db.commit()
    print("\nUpdates committed successfully.")
    db.close()

if __name__ == "__main__":
    update_modo_uso()
