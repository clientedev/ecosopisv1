from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models import models
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    
    # Create Admin
    admin = db.query(models.User).filter(models.User.email == "admin@admin.com").first()
    if not admin:
        admin = models.User(
            email="admin@admin.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Principal",
            role="admin"
        )
        db.add(admin)

    # Create Initial Products
    products = [
        # Sabonetes Naturais
        {
            "name": "Sabonete de Açafrão e Dolomita",
            "slug": "sabonete-acafrao-dolomita",
            "description": "Sabonete natural ideal para tratamento de foliculite e renovação celular.",
            "ingredients": "Açafrão puro, Dolomita, Óleos vegetais saponificados.",
            "benefits": "Ação anti-inflamatória, clareadora e cicatrizante.",
            "price": 25.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
            "tags": ["sabonete", "acafrao", "dolomita", "skin:oily", "acne", "foliculite"],
            "buy_on_site": True
        },
        {
            "name": "Sabonete Clareador de Argila Branca e Dolomita",
            "slug": "sabonete-clareador-argila-branca",
            "description": "Potente clareador natural para manchas e uniformização do tom da pele.",
            "ingredients": "Argila Branca, Dolomita, Ativos botânicos.",
            "benefits": "Clareamento de manchas, suavidade e maciez.",
            "price": 28.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
            "tags": ["sabonete", "clareador", "spots", "skin:normal", "skin:dry"],
            "buy_on_site": True
        },
        {
            "name": "Sabonete Íntimo de Barbatimão com Calêndula",
            "slug": "sabonete-intimo-barbatimao",
            "description": "Cuidado suave e natural para a região íntima.",
            "ingredients": "Extrato de Barbatimão, Calêndula, pH equilibrado.",
            "benefits": "Ação antisséptica, cicatrizante e calmante.",
            "price": 32.00,
            "stock": 80,
            "image_url": "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
            "tags": ["sabonete", "intimo", "barbatimao", "sensitivity"],
            "buy_on_site": True
        },
        {
            "name": "Sabonete de Argila Verde",
            "slug": "sabonete-argila-verde",
            "description": "Controle intenso de oleosidade para peles acneicas.",
            "ingredients": "Argila Verde pura, Óleos essenciais purificantes.",
            "benefits": "Desintoxicação, controle de brilho e redução de poros.",
            "price": 22.00,
            "stock": 120,
            "image_url": "/static/attached_assets/generated_images/natural_green_clay_soap_bar_photography.png",
            "tags": ["sabonete", "argila-verde", "skin:oily", "acne"],
            "buy_on_site": True
        },
        {
            "name": "Sabonete de Carvão Ativado",
            "slug": "sabonete-carvao-ativado",
            "description": "Limpeza profunda e remoção de impurezas urbanas.",
            "ingredients": "Carvão vegetal ativado, Extratos botânicos.",
            "benefits": "Remoção de toxinas, limpeza de poros e ação detox.",
            "price": 24.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/natural_charcoal_soap_bar_photography.png",
            "tags": ["sabonete", "carvao", "skin:mixed", "skin:oily"],
            "buy_on_site": True
        },
        {
            "name": "Sabonete de Rosa Mosqueta e Argila Rosa",
            "slug": "sabonete-rosa-mosqueta-argila-rosa",
            "description": "Hidratação e regeneração para peles delicadas.",
            "ingredients": "Óleo de Rosa Mosqueta, Argila Rosa, Manteigas vegetais.",
            "benefits": "Hidratação profunda, regeneração celular e suavidade.",
            "price": 30.00,
            "stock": 90,
            "image_url": "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
            "tags": ["sabonete", "hidratante", "skin:dry", "sensitivity", "aging"],
            "buy_on_site": True
        },
        {
            "name": "Sabonete Líquido de Barbatimão e Calêndula (250ml)",
            "slug": "sabonete-liquido-barbatimao",
            "description": "Praticidade e suavidade em versão líquida com óleos essenciais.",
            "ingredients": "Barbatimão, Calêndula, Óleo essencial de Melaleuca.",
            "benefits": "Limpeza suave e terapêutica.",
            "price": 45.00,
            "stock": 50,
            "image_url": "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
            "tags": ["sabonete-liquido", "barbatimao", "sensitivity"],
            "buy_on_site": True
        },
        # Cremes e Tratamentos
        {
            "name": "Creme para Oleosidade e Acne Natural",
            "slug": "creme-oleosidade-acne",
            "description": "Tratamento noturno para controle de espinhas e brilho.",
            "ingredients": "Melaleuca, Niacinamida vegetal, Zinco.",
            "benefits": "Secativo, controlador de oleosidade e calmante.",
            "price": 68.00,
            "stock": 70,
            "image_url": "/static/attached_assets/generated_images/skincare_serum_bottle_botanical_setup.png",
            "tags": ["creme", "acne", "skin:oily", "facial"],
            "buy_on_site": True
        },
        {
            "name": "Creme para Rachaduras – Pés de Anjo",
            "slug": "creme-pes-de-anjo",
            "description": "Hidratação ultra profunda para pés extremamente secos.",
            "ingredients": "Ureia vegetal, Manteiga de Cacau, Óleo de Copaíba.",
            "benefits": "Cicatrização de rachaduras e maciez extrema.",
            "price": 42.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/skincare_serum_bottle_botanical_setup.png",
            "tags": ["creme", "pes", "hidratante"],
            "buy_on_site": True
        },
        {
            "name": "Desodorante Clareador Sólido",
            "slug": "desodorante-clareador-solido",
            "description": "Proteção natural que ajuda a clarear as axilas.",
            "ingredients": "Bicarbonato de sódio, Óleo de Coco, Dolomita.",
            "benefits": "Proteção duradoura e clareamento suave.",
            "price": 38.00,
            "stock": 150,
            "image_url": "/static/attached_assets/generated_images/skincare_serum_bottle_botanical_setup.png",
            "tags": ["desodorante", "clareador", "spots"],
            "buy_on_site": True
        },
        {
            "name": "Tônico Facial Antioxidante",
            "slug": "tonico-facial-antioxidante",
            "description": "Revitalização e equilíbrio do pH facial.",
            "ingredients": "Extrato de Chá Verde, Vitamina E, Hidrolatos.",
            "benefits": "Combate radicais livres e prepara a pele.",
            "price": 55.00,
            "stock": 60,
            "image_url": "/static/attached_assets/generated_images/skincare_serum_bottle_botanical_setup.png",
            "tags": ["tonico", "antioxidante", "facial", "todos-os-tipos"],
            "buy_on_site": True
        },
        {
            "name": "Manteiga de Ojon – Cabelo e Corpo",
            "slug": "manteiga-ojon",
            "description": "O 'ouro líquido' do Caribe para nutrição extrema.",
            "ingredients": "Óleo de Ojon puro, Vitamina A.",
            "benefits": "Restauração capilar e hidratação corporal intensa.",
            "price": 75.00,
            "stock": 40,
            "image_url": "/static/attached_assets/generated_images/natural_skincare_kit_gift_box.png",
            "tags": ["manteiga", "hair:damaged", "hair:dry", "hidratante"],
            "buy_on_site": True
        },
        # Óleos Vegetais
        {
            "name": "Óleo de Rosa Mosqueta 100% Puro",
            "slug": "oleo-rosa-mosqueta-puro",
            "description": "O melhor regenerador natural para cicatrizes e manchas.",
            "ingredients": "Óleo de Rosa Mosqueta Rubiginosa prensado a frio.",
            "benefits": "Regeneração, clareamento e anti-envelhecimento.",
            "price": 89.00,
            "stock": 50,
            "image_url": "/static/attached_assets/generated_images/rosa_mosqueta_serum_bottle_photography.png",
            "tags": ["oleo", "spots", "aging", "skin:dry", "facial"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Vegetal de Rosa Mosqueta 20ml",
            "slug": "oleo-rosa-mosqueta-20ml",
            "description": "Versão compacta do regenerador mais amado.",
            "ingredients": "Óleo de Rosa Mosqueta puro.",
            "benefits": "Praticidade e eficácia regeneradora.",
            "price": 45.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "spots", "facial"],
            "buy_on_site": True
        },
        {
            "name": "Refil 60ml Óleo de Rosa Mosqueta",
            "slug": "refil-rosa-mosqueta",
            "description": "Economia e sustentabilidade para seu tratamento.",
            "ingredients": "Óleo de Rosa Mosqueta puro.",
            "benefits": "Melhor custo-benefício para uso contínuo.",
            "price": 115.00,
            "stock": 30,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "refil", "spots"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Vegetal de Alecrim 100% Puro",
            "slug": "oleo-alecrim",
            "description": "Estimulante natural para couro cabeludo e foco.",
            "ingredients": "Óleo vegetal de Alecrim.",
            "benefits": "Fortalecimento capilar e estimulante.",
            "price": 35.00,
            "stock": 80,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "hair:damaged", "hair:oily", "hair"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Vegetal de Semente de Uva",
            "slug": "oleo-semente-uva",
            "description": "Óleo leve e versátil para massagem e hidratação.",
            "ingredients": "Óleo de semente de uva puro.",
            "benefits": "Rápida absorção e rico em vitamina E.",
            "price": 38.00,
            "stock": 60,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "hidratante", "skin:normal"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Vegetal de Rícino",
            "slug": "oleo-ricino",
            "description": "O segredo para crescimento de fios e sobrancelhas.",
            "ingredients": "Óleo de Rícino puro.",
            "benefits": "Crescimento acelerado e fortalecimento.",
            "price": 32.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "hair:damaged", "hair"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Vegetal de Abacate",
            "slug": "oleo-abacate",
            "description": "Nutrição profunda para peles e cabelos ressecados.",
            "ingredients": "Óleo de Abacate puro.",
            "benefits": "Altamente nutritivo e protetor.",
            "price": 40.00,
            "stock": 50,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "skin:dry", "hair:dry"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Vegetal de Argan",
            "slug": "oleo-argan",
            "description": "Finalizador luxuoso para brilho e controle de frizz.",
            "ingredients": "Óleo de Argan de Marrocos.",
            "benefits": "Brilho intenso e selagem de cutículas.",
            "price": 95.00,
            "stock": 40,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oleo", "hair:dry", "hair"],
            "buy_on_site": True
        },
        # Óleos Essenciais
        {
            "name": "Óleo Essencial Lavanda Francesa",
            "slug": "oe-lavanda",
            "description": "O rei da aromaterapia para relaxamento e pele.",
            "ingredients": "Lavandula angustifolia pura.",
            "benefits": "Calmante, cicatrizante e relaxante.",
            "price": 62.00,
            "stock": 100,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oe", "sensitivity", "aromaterapia"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Essencial Menta Piperita",
            "slug": "oe-menta",
            "description": "Energia e frescor imediato para foco e respiração.",
            "ingredients": "Mentha piperita pura.",
            "benefits": "Refrescante, analgésico e estimulante.",
            "price": 58.00,
            "stock": 80,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oe", "hair:oily", "frescor"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Essencial Melaleuca (Tea Tree)",
            "slug": "oe-melaleuca",
            "description": "Poderoso antisséptico natural para acne e fungos.",
            "ingredients": "Melaleuca alternifolia pura.",
            "benefits": "Bactericida, fungicida e secativo.",
            "price": 65.00,
            "stock": 90,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oe", "acne", "skin:oily"],
            "buy_on_site": True
        },
        {
            "name": "Óleo Essencial Laranja Doce",
            "slug": "oe-laranja",
            "description": "O óleo da alegria e detox linfático.",
            "ingredients": "Citrus aurantium dulcis pura.",
            "benefits": "Antidepressivo e lipolítico.",
            "price": 42.00,
            "stock": 120,
            "image_url": "/static/attached_assets/generated_images/natural_oils_collection_product_shot.png",
            "tags": ["oe", "detox", "alegria"],
            "buy_on_site": True
        },
        # Kits
        {
            "name": "Kit para Acne e Oleosidade",
            "slug": "kit-acne",
            "description": "Tratamento completo: Limpeza, tonificação e secagem.",
            "ingredients": "Sabonete Argila Verde + Tônico + Creme Acne.",
            "benefits": "Pele limpa, sem brilho e sem espinhas.",
            "price": 135.00,
            "stock": 30,
            "image_url": "/static/attached_assets/generated_images/natural_skincare_kit_gift_box.png",
            "tags": ["kit", "acne", "skin:oily"],
            "buy_on_site": True
        },
        {
            "name": "Kit Sabonetes Açafrão e Argila Branca",
            "slug": "kit-acafrao-argila",
            "description": "A dupla perfeita para clareamento e foliculite.",
            "ingredients": "1 Sabonete Açafrão + 1 Sabonete Argila Branca.",
            "benefits": "Pele uniforme e livre de inflamações.",
            "price": 48.00,
            "stock": 50,
            "image_url": "/static/attached_assets/generated_images/natural_skincare_kit_gift_box.png",
            "tags": ["kit", "spots", "foliculite"],
            "buy_on_site": True
        },
        {
            "name": "Kit Clareamento Potente",
            "slug": "kit-clareamento",
            "description": "Tratamento intensivo para manchas persistentes.",
            "ingredients": "Sabonete Clareador + Óleo Rosa Mosqueta + Desodorante.",
            "benefits": "Clareamento visível e hidratação.",
            "price": 145.00,
            "stock": 20,
            "image_url": "/static/attached_assets/generated_images/natural_skincare_kit_gift_box.png",
            "tags": ["kit", "spots", "facial"],
            "buy_on_site": True
        },
        {
            "name": "Kit Sabonetes – 60 unidades",
            "slug": "kit-60-sabonetes",
            "description": "Ideal para revendedores ou brindes especiais.",
            "ingredients": "Sortimento de sabonetes artesanais variados.",
            "benefits": "Economia no atacado.",
            "price": 750.00,
            "stock": 10,
            "image_url": "/static/attached_assets/generated_images/natural_skincare_kit_gift_box.png",
            "tags": ["kit", "atacado"],
            "buy_on_site": True
        },
        {
            "name": "Kit Atacado de Sabonetes",
            "slug": "kit-atacado-geral",
            "description": "Mix completo de nossa saboaria para seu negócio.",
            "ingredients": "Variedade de todas as nossas linhas.",
            "benefits": "Margem de lucro para revenda.",
            "price": 450.00,
            "stock": 15,
            "image_url": "/static/attached_assets/generated_images/natural_skincare_kit_gift_box.png",
            "tags": ["kit", "atacado"],
            "buy_on_site": True
        }
    ]

    for p_data in products:
        db_product = db.query(models.Product).filter(models.Product.slug == p_data["slug"]).first()
        if not db_product:
            db_product = models.Product(**p_data)
            db.add(db_product)
    
    # Create Initial Carousel Items
    if db.query(models.CarouselItem).count() == 0:
        carousel_items = [
            {
                "title": "Beleza que Floresce do Interior",
                "description": "Cosméticos naturais e veganos criados com a pureza da botânica brasileira.",
                "image_url": "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png",
                "badge": "100% VEGANO",
                "cta_primary_text": "VER PRODUTOS",
                "cta_primary_link": "/produtos",
                "cta_secondary_text": "FAZER QUIZZ",
                "cta_secondary_link": "/quizz"
            }
        ]
        for s_data in carousel_items:
            item = models.CarouselItem(**s_data)
            db.add(item)
        db.commit()

    print("Database seeded!")
    db.close()

if __name__ == "__main__":
    seed()
