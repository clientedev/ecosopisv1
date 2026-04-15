from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_remaining():
    db = SessionLocal()

    # Soaps Mode of use & Benefits updates
    updates = [
        {
            "slug": "sabonete-acafrao-dolomita",
            "modo": "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário.",
            "beneficio": "Ajuda a combater a foliculite, auxilia na redução de pelos, cicatrizante e anti-inflamatório",
        },
        {
            "slug": "sabonete-clareador-argila-branca",
            "modo": "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente. Uso diário.",
            "beneficio": "Auxilia no clareamento da pele, melhora a aparência de manchas e deixa a pele mais uniforme e viçosa",
        },
        {
            "slug": "sabonete-intimo-barbatimao",
            "modo": "Aplicar na região externa íntima durante o banho, massagear suavemente e enxaguar bem. Uso diário.",
            "beneficio": "Cicatrizante natural, auxilia na saúde genital feminina, anti-inflamatório." # Keeping generic benefit or leaving as it is if it has it
        }
    ]
    
    print("--- Atualizando Restantes ---")
    for upd in updates:
        slug = upd["slug"]
        modo = upd["modo"]
        
        p = db.query(Product).filter(Product.slug == slug).first()
        if p:
            print(f"Updating: {p.name} ({p.slug})")
            if "beneficio" in upd and upd["beneficio"]:
                 p.benefits = upd["beneficio"]
                 
            if p.details:
                p.details.modo_de_uso = modo
                if "beneficio" in upd and upd["beneficio"]:
                     p.details.beneficios = upd["beneficio"]
            else:
                p.details = ProductDetail(product_id=p.id, slug=p.slug, modo_de_uso=modo)
                if "beneficio" in upd and upd["beneficio"]:
                     p.details.beneficios = upd["beneficio"]
        else:
            print(f"NOT FOUND SLUG: {slug}")

    db.commit()
    print("\nUpdates committed successfully.")
    db.close()

if __name__ == "__main__":
    update_remaining()
