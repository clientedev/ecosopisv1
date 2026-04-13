import os
import sys

# Remove frontend folders
def run():
    import shutil
    box_dir = r"c:\Users\Gabriel Eduardo\Documents\ecosopis\ecosopisv1\frontend\src\app\box"
    if os.path.exists(box_dir):
        shutil.rmtree(box_dir)
    admin_box_dir = r"c:\Users\Gabriel Eduardo\Documents\ecosopis\ecosopisv1\frontend\src\app\admin\dashboard\box"
    if os.path.exists(admin_box_dir):
        shutil.rmtree(admin_box_dir)

    sys.path.append(r"c:\Users\Gabriel Eduardo\Documents\ecosopis\ecosopisv1\backend")
    from app.core.database import SessionLocal
    from app.models.models import Product, ProductDetail

    db = SessionLocal()

    sabonete_text = "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e, em seguida, enxágue completamente."
    sabonete_ingr = "glicerina e lauril vegetais, barbatimão, açafrão e dolomita"
    ojon_usage = ("A manteiga de ojon pode ser utilizada no cabelo e na pele como um tratamento nutritivo intensivo.\n\n"
                  "No cabelo: aplicar nos fios secos antes da lavagem ou misturar a máscaras capilares para potencializar a nutrição.\n\n"
                  "Na pele: aplicar uma pequena quantidade com a pele levemente úmida, após o banho, ou misturar ao hidratante corporal para facilitar a absorção. "
                  "Também pode ser utilizada como tratamento noturno em áreas mais ressecadas, como pés, joelhos e cotovelos.\n\n"
                  "Por ser naturalmente rica e pigmentada, recomenda-se o uso em pequenas quantidades.")

    oil_disclaimer = ("\n\nATENÇÃO: Óleos vegetais são recomendados para uso noturno, pois são fotossensíveis e, em contato com o sol, podem causar manchas na pele. "
                      "Não aplique óleos essenciais puros diretamente na pele, pois são extremamente concentrados e podem causar alergias ou irritações.")

    # Apply to DB
    products = db.query(Product).all()
    for p in products:
        if p.details:
            # Sabonete de açafrão fixes
            if "açafrão" in p.name.lower() and "sabonete" in p.name.lower():
                p.details.modo_de_uso = sabonete_text
                p.ingredients = sabonete_ingr
                p.details.ingredientes = sabonete_ingr
            
            # General sabonetes (if we match just sabonete)
            if "sabonete" in p.name.lower() and not "açafrão" in p.name.lower():
                p.details.modo_de_uso = sabonete_text
            
            # Manteiga de Ojon
            if "ojon" in p.name.lower():
                p.details.modo_de_uso = ojon_usage
            
            # Oil rules
            if "óleo" in p.name.lower() or "oleo" in p.name.lower():
                if p.details.modo_de_uso:
                    # Remove bad advice if present
                    p.details.modo_de_uso = p.details.modo_de_uso.replace("aplique diretamente", "dilua antes de aplicar")
                    p.details.modo_de_uso = p.details.modo_de_uso.replace("uso diurno", "uso noturno")
                    if "fotossensíveis" not in p.details.modo_de_uso:
                        p.details.modo_de_uso += oil_disclaimer

    db.commit()
    db.close()
    print("Database updated successfully.")

if __name__ == '__main__':
    run()
