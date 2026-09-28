import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import models

PATHS = [
    "/", "/", "/", "/",
    "/produtos",
    "/produto/sabonete-de-açafrão-e-dolomita",
    "/produto/kit-clareamento-potente",
    "/produto/oleo-vegetal-de-rosa-mosqueta-rubiginosa-100-puro",
    "/produto/sabonete-clareador-de-argila-branca-e-dolomita",
    "/quizz",
    "/lia",
    "/atacado",
    "/novidades"
]

PRODUCT_WEIGHTS = {
    1: 20,   # Sabonete de Açafrão e Dolomita
    27: 15,  # Kit Clareamento Potente
    14: 15,  # Óleo Rosa Mosqueta Rubiginosa
    15: 10,  # Refil 60ml Rosa Mosqueta
    26: 10,  # Kit Sabonetes Açafrão e Argila Branca
    2: 8,    # Sabonete Clareador Argila Branca
    38: 8,   # Tônico Capilar Anti Queda
    17: 6,   # Óleo Semente de Uva
    25: 6,   # Kit Acne e Oleosidade
    3: 5,    # Sabonete Íntimo Barbatimão
    23: 4,   # Óleo Melaleuca
    42: 4,   # Óleo Alecrim
    21: 4,   # Óleo Lavanda
    22: 4,   # Óleo Menta
    20: 3,   # Óleo Argan
    18: 3,   # Óleo Rícino
    19: 3,   # Óleo Abacate
    6: 3,    # Sabonete Rosa Mosqueta
    4: 3,    # Sabonete Argila Verde
    5: 3,    # Sabonete Carvão Ativado
}

LIA_QUESTIONS = [
    ("Como usar o sabonete de açafrão no rosto?", "Rotina para Pele Oleosa", "Para o sabonete de açafrão, umedeça o rosto com água morna e aplique suavemente em movimentos circulares. Deixe agir por cerca de 1 a 2 minutos e enxágue bem. Pode ser usado diariamente! 🌿"),
    ("Qual produto é melhor para clarear manchas de acne?", "Clareamento & Manchas", "O nosso Kit Clareamento Potente combinado com o Óleo de Rosa Mosqueta à noite é o tratamento mais indicado e eficaz para suavizar manchas gradativamente. ✨"),
    ("Qual o prazo de entrega para São Paulo?", "Prazo de Envio / Frete", "O envio para São Paulo normalmente leva entre 2 a 5 dias úteis após a confirmação do pagamento. Entregamos para todo o Brasil! 📦"),
    ("O óleo de rosa mosqueta pode ser usado de dia?", "Óleos & Cuidados Capilares", "Os óleos vegetais puros têm potencial fotossensível com a exposição solar direta. Por segurança, recomendamos usar sempre na rotina noturna antes de dormir! 🌙"),
    ("Vocês vendem no atacado para revenda?", "Dúvidas sobre Atacado", "Sim! Temos condições especiais para compras no atacado a partir de quantidades mínimas. Você pode conferir a aba Atacado no menu! 🌿")
]

def redistribute_exact_metrics(db: Session):
    print("Iniciando redistribuição exata de métricas...", flush=True)
    
    # 1. Carrega produtos válidos
    products = db.query(models.Product).all()
    if products:
        available_ids = [p.id for p in products]
        weights = [PRODUCT_WEIGHTS.get(pid, 2) for pid in available_ids]
    else:
        available_ids = list(PRODUCT_WEIGHTS.keys())
        weights = list(PRODUCT_WEIGHTS.values())

    # 2. Limpa dados anteriores
    db.query(models.SiteVisit).delete()
    db.query(models.ProductClick).delete()
    db.query(models.LiaInteraction).delete()
    db.commit()

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    # Cotas diárias exatas para os últimos 7 dias (dias 6 até 0)
    # Total visitas: 128 + 135 + 142 + 130 + 125 + 132 + 133 = 925
    visits_per_day = [128, 135, 142, 130, 125, 132, 133]
    # Total shopee: 14 + 16 + 15 + 13 + 14 + 15 + 14 = 101
    shopee_per_day = [14, 16, 15, 13, 14, 15, 14]
    # Total site buy: 7 + 8 + 8 + 7 + 7 + 8 + 8 = 53
    site_per_day   = [7, 8, 8, 7, 7, 8, 8]
    # Total lia: 1 + 0 + 1 + 1 + 0 + 1 + 1 = 5
    lia_per_day    = [1, 0, 1, 1, 0, 1, 1]

    visit_mappings = []
    click_mappings = []
    lia_mappings = []

    # 3. Gerar últimos 7 dias
    for i in range(7):
        day_offset = 6 - i # i=0 -> 6 dias atrás; i=6 -> hoje (0 dias atrás)
        base_day = now_utc - timedelta(days=day_offset)

        # Horário limite para hoje
        max_hour = max(1, now_utc.hour) if day_offset == 0 else 23

        # Visitas do dia
        for _ in range(visits_per_day[i]):
            h = random.randint(0, max_hour)
            m = random.randint(0, 59)
            s = random.randint(0, 59)
            dt = base_day.replace(hour=h, minute=m, second=s, microsecond=0)
            visit_mappings.append({"path": random.choice(PATHS), "created_at": dt})

        # Saídas Shopee do dia
        for _ in range(shopee_per_day[i]):
            h = random.randint(0, max_hour)
            m = random.randint(0, 59)
            s = random.randint(0, 59)
            dt = base_day.replace(hour=h, minute=m, second=s, microsecond=0)
            pid = random.choices(available_ids, weights=weights, k=1)[0]
            click_mappings.append({"product_id": pid, "click_type": "shopee", "created_at": dt})

        # Cliques Comprar (Site) do dia
        for _ in range(site_per_day[i]):
            h = random.randint(0, max_hour)
            m = random.randint(0, 59)
            s = random.randint(0, 59)
            dt = base_day.replace(hour=h, minute=m, second=s, microsecond=0)
            pid = random.choices(available_ids, weights=weights, k=1)[0]
            click_mappings.append({"product_id": pid, "click_type": "site", "created_at": dt})

        # Interações Lia do dia
        for _ in range(lia_per_day[i]):
            h = random.randint(0, max_hour)
            m = random.randint(0, 59)
            s = random.randint(0, 59)
            dt = base_day.replace(hour=h, minute=m, second=s, microsecond=0)
            q, topic, ans = random.choice(LIA_QUESTIONS)
            lia_mappings.append({
                "user_id": None,
                "user_message": q,
                "bot_response": ans,
                "topic": topic,
                "created_at": dt
            })

    # 4. Gerar Histórico Dias 8 a 30 (para filtros de 30d e All)
    for day in range(8, 30):
        base_day = now_utc - timedelta(days=day)
        nv = random.randint(18, 30)
        ns = random.randint(6, 11)
        nc = random.randint(3, 7)
        nl = random.randint(1, 3)

        for _ in range(nv):
            dt = base_day.replace(hour=random.randint(0, 23), minute=random.randint(0, 59), second=random.randint(0, 59), microsecond=0)
            visit_mappings.append({"path": random.choice(PATHS), "created_at": dt})

        for _ in range(ns):
            dt = base_day.replace(hour=random.randint(0, 23), minute=random.randint(0, 59), second=random.randint(0, 59), microsecond=0)
            pid = random.choices(available_ids, weights=weights, k=1)[0]
            click_mappings.append({"product_id": pid, "click_type": "shopee", "created_at": dt})

        for _ in range(nc):
            dt = base_day.replace(hour=random.randint(0, 23), minute=random.randint(0, 59), second=random.randint(0, 59), microsecond=0)
            pid = random.choices(available_ids, weights=weights, k=1)[0]
            click_mappings.append({"product_id": pid, "click_type": "site", "created_at": dt})

        for _ in range(nl):
            dt = base_day.replace(hour=random.randint(0, 23), minute=random.randint(0, 59), second=random.randint(0, 59), microsecond=0)
            q, topic, ans = random.choice(LIA_QUESTIONS)
            lia_mappings.append({
                "user_id": None,
                "user_message": q,
                "bot_response": ans,
                "topic": topic,
                "created_at": dt
            })

    # 5. Inserção em Lote de Alta Performance
    print(f"Inserindo {len(visit_mappings)} visitas...", flush=True)
    db.bulk_insert_mappings(models.SiteVisit, visit_mappings)

    print(f"Inserindo {len(click_mappings)} cliques...", flush=True)
    db.bulk_insert_mappings(models.ProductClick, click_mappings)

    print(f"Inserindo {len(lia_mappings)} interações LIA...", flush=True)
    db.bulk_insert_mappings(models.LiaInteraction, lia_mappings)

    db.commit()

    # 6. Sincronizar sequences se for PostgreSQL
    try:
        is_postgres = "postgres" in str(db.bind.url)
        if is_postgres:
            db.execute(text("SELECT setval(pg_get_serial_sequence('site_visits', 'id'), COALESCE(MAX(id), 1)) FROM site_visits;"))
            db.execute(text("SELECT setval(pg_get_serial_sequence('product_clicks', 'id'), COALESCE(MAX(id), 1)) FROM product_clicks;"))
            db.execute(text("SELECT setval(pg_get_serial_sequence('lia_interactions', 'id'), COALESCE(MAX(id), 1)) FROM lia_interactions;"))
            db.commit()
    except Exception as seq_err:
        print(f"Aviso sequence: {seq_err}", flush=True)

    print("[OK] Redistribuicao de metricas concluida com sucesso!", flush=True)
