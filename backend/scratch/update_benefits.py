from app.core.database import SessionLocal
from app.models.models import Product, ProductDetail

def update_benefits_and_usage():
    db = SessionLocal()

    # --- Benefícios dos Sabonetes ---
    sabonete_benefits = {
        "sabonete-acafrao": "Ajuda a combater a foliculite, auxilia na redução de pelos, cicatrizante e anti-inflamatório",
        "sabonete-clareador": "Auxilia no clareamento da pele, melhora a aparência de manchas e deixa a pele mais uniforme e viçosa",
        "sabonete-argila-verde": "Controla a oleosidade, ajuda no combate à acne, desintoxica e purifica a pele",
        "sabonete-carvao-ativado": "Limpeza profunda, desobstrução dos poros, ação calmante e auxílio no controle da acne",
        "sabonete-rosa-mosqueta-argila-rosa": "Hidrata, ajuda na regeneração da pele e deixa a pele mais macia",
    }
    
    print("--- Atualizando Benefícios ---")
    for slug, benefit in sabonete_benefits.items():
        p = db.query(Product).filter(Product.slug == slug).first()
        if p:
            print(f"Updating Benefícios: {p.name} ({p.slug})")
            p.benefits = benefit
            if p.details:
                p.details.beneficios = benefit
            else:
                p.details = ProductDetail(product_id=p.id, slug=p.slug, beneficios=benefit)
        else:
             print(f"NOT FOUND SLUG (Sabonete): {slug}")
             
    # Try finding the 'Sabonete Líquido 3 em 1' or 'Sabonete Líquido de Barbatimão'
    p_liquido = db.query(Product).filter(Product.name.ilike('%Sabonete L%quido%')).first()
    if p_liquido:
       print(f"Updating Benefícios: {p_liquido.name} ({p_liquido.slug})")
       liq_benefit = "Limpa profundamente sem ressecar, auxilia no controle da acne e oleosidade."
       p_liquido.benefits = liq_benefit
       if p_liquido.details:
            p_liquido.details.beneficios = liq_benefit
       else:
            p_liquido.details = ProductDetail(product_id=p_liquido.id, slug=p_liquido.slug, beneficios=liq_benefit)
    else:
       print("NOT FOUND: Sabonete Líquido")
       

    # --- Modo de Uso dos Óleos Vegetais ---
    modo_veg = "Podem ser utilizados na pele e nos cabelos. Na pele: aplicar algumas gotas na pele limpa e seca, massageando até completa absorção. Uso noturno pois o óleo é fotossensível e o seu uso em contato com o sol pode ocasionar em manchas, utilize sempre o protetor solar. Nos cabelos: aplicar no comprimento e pontas para hidratação e nutrição, ou no couro cabeludo com massagem antes da lavagem. Também podem ser usados como potencializadores em cremes e máscaras capilares."
    veg_slugs = [
        "oleo-rosa-mosqueta-puro", "oleo-rosa-mosqueta-20ml", "oleo-alecrim", 
        "oleo-abacate", "oleo-semente-uva", "oleo-ricino", "oleo-argan", "refil-rosa-mosqueta"
    ]
    
    print("\n--- Atualizando Modo de Uso (Óleos Vegetais) ---")
    for slug in veg_slugs:
        p = db.query(Product).filter(Product.slug == slug).first()
        if p:
            print(f"Updating Modo de Uso: {p.name} ({p.slug})")
            if p.details:
                p.details.modo_de_uso = modo_veg
            else:
                p.details = ProductDetail(product_id=p.id, slug=p.slug, modo_de_uso=modo_veg)
        else:
             print(f"NOT FOUND SLUG (Vegetal): {slug}")


    # --- Modo de Uso dos Óleos Essenciais ---
    modo_essencial = "Sempre utilizar diluído. Na pele: diluir algumas gotas em óleo vegetal e aplicar na região desejada. Nos cabelos: misturar algumas gotas em óleos vegetais ou máscaras capilares. No ambiente: utilizar em difusores aromáticos para promover bem-estar e aromatização. Observação: não aplicar diretamente na pele sem diluição."
    essencial_slugs = [
        "oe-lavanda", "oe-melaleuca", "oe-menta", "oe-laranja"
    ]

    print("\n--- Atualizando Modo de Uso (Óleos Essenciais) ---")
    for slug in essencial_slugs:
        p = db.query(Product).filter(Product.slug == slug).first()
        if p:
            print(f"Updating Modo de Uso: {p.name} ({p.slug})")
            if p.details:
                p.details.modo_de_uso = modo_essencial
            else:
                p.details = ProductDetail(product_id=p.id, slug=p.slug, modo_de_uso=modo_essencial)
        else:
             print(f"NOT FOUND SLUG (Essencial): {slug}")


    db.commit()
    print("\nUpdates committed successfully.")
    db.close()

if __name__ == "__main__":
    update_benefits_and_usage()
