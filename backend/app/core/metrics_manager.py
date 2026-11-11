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
    ("Vocês vendem no atacado para revenda?", "Dúvidas sobre Atacado", "Sim! Temos condições especiais para compras no atacado a partir de quantidades mínimas. Você pode conferir a aba Atacado no menu! 🌿"),
    ("Qual sabonete ajuda mais no controle de espinhas?", "Rotina para Pele Oleosa", "O Sabonete de Argila Verde com Tea Tree e o Sabonete de Carvão Ativado ajudam a controlar a oleosidade excessiva e limpar profundamente os poros. 💚"),
    ("O tônico capilar funciona para queda de cabelo?", "Óleos & Cuidados Capilares", "Sim! Nosso Tônico Capilar Anti Queda fortalece a raiz, estimula o crescimento e reduz a quebra já nas primeiras semanas de uso contínuo. 🌿"),
    ("Como faço para calcular o frete do meu pedido?", "Prazo de Envio / Frete", "Basta adicionar os produtos no carrinho e digitar seu CEP que o sistema calcula automaticamente as opções via Loggi, J&T Express e Correios! 📦"),
]


def _distribute_across_days(total: int, days: int = 7) -> list:
    """Distribui um total inteiro ao longo de N dias com variação orgânica natural cuja soma é exata."""
    if total <= 0:
        return [0] * days
    # Pesos naturais (último índice = dia atual em andamento, levemente menor)
    base_weights = [0.92, 1.05, 1.14, 0.96, 1.08, 1.16, 0.69]
    weights = [w * random.uniform(0.9, 1.1) for w in base_weights[:days]]
    weight_sum = sum(weights)
    counts = [int((total * w) / weight_sum) for w in weights]
    remainder = total - sum(counts)
    # Distribui eventual resto de forma aleatória ponderada
    indices = list(range(days))
    for _ in range(remainder):
        chosen = random.choices(indices, weights=weights, k=1)[0]
        counts[chosen] += 1
    return counts


def _random_dt_for_day(now_utc: datetime, day_offset: int) -> datetime:
    """Gera um timestamp aleatório dentro do dia UTC alvo sem nunca ultrapassar now_utc."""
    target_day = now_utc - timedelta(days=day_offset)
    day_start = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
    if day_offset == 0:
        elapsed_secs = max(60, int((now_utc - day_start).total_seconds()))
        return day_start + timedelta(seconds=random.randint(0, elapsed_secs))
    return day_start + timedelta(
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59),
    )

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
    # Total visitas: 256 + 263 + 272 + 259 + 253 + 259 + 246 = 1808 (1100 anteriores + 708 adicionais)
    visits_per_day = [256, 263, 272, 259, 253, 259, 246]
    # Total shopee: 61 + 62 + 63 + 62 + 60 + 62 + 59 = 429 (321 anteriores + 108 adicionais)
    shopee_per_day = [61, 62, 63, 62, 60, 62, 59]
    # Total site buy: 9 + 9 + 9 + 8 + 9 + 9 + 7 = 60 (41 anteriores + 19 adicionais)
    site_per_day   = [9, 9, 9, 8, 9, 9, 7]
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


def inject_additional_metrics(
    db: Session,
    add_shopee: int = 0,
    add_site_clicks: int = 0,
    add_visits: int = 0,
    add_lia: int = 0,
):
    """
    Injeta métricas adicionais distribuídas de forma natural nos últimos 7 dias somadas ao que já tem no banco (sem deletar nada).
    """
    print(f"Iniciando injeção adicional (+{add_shopee} shopee, +{add_site_clicks} compras, +{add_visits} visitas, +{add_lia} lia)...", flush=True)
    products = db.query(models.Product).filter(models.Product.is_active == True).all()
    if not products:
        products = db.query(models.Product).all()
    if products:
        available_ids = [p.id for p in products]
        weights = [PRODUCT_WEIGHTS.get(pid, 2) for pid in available_ids]
    else:
        available_ids = list(PRODUCT_WEIGHTS.keys())
        weights = list(PRODUCT_WEIGHTS.values())

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    inc_visits = _distribute_across_days(max(0, int(add_visits)), 7)
    inc_shopee = _distribute_across_days(max(0, int(add_shopee)), 7)
    inc_site   = _distribute_across_days(max(0, int(add_site_clicks)), 7)
    inc_lia    = _distribute_across_days(max(0, int(add_lia)), 7)

    visit_mappings = []
    click_mappings = []
    lia_mappings = []

    for i in range(7):
        day_offset = 6 - i

        for _ in range(inc_visits[i]):
            dt = _random_dt_for_day(now_utc, day_offset)
            visit_mappings.append({"path": random.choice(PATHS), "created_at": dt})

        for _ in range(inc_shopee[i]):
            dt = _random_dt_for_day(now_utc, day_offset)
            pid = random.choices(available_ids, weights=weights, k=1)[0]
            click_mappings.append({"product_id": pid, "click_type": "shopee", "created_at": dt})

        for _ in range(inc_site[i]):
            dt = _random_dt_for_day(now_utc, day_offset)
            pid = random.choices(available_ids, weights=weights, k=1)[0]
            click_mappings.append({"product_id": pid, "click_type": "site", "created_at": dt})

        for _ in range(inc_lia[i]):
            dt = _random_dt_for_day(now_utc, day_offset)
            q, topic, ans = random.choice(LIA_QUESTIONS)
            lia_mappings.append({
                "user_id": None,
                "user_message": q,
                "bot_response": ans,
                "topic": topic,
                "created_at": dt,
            })

    if visit_mappings:
        db.bulk_insert_mappings(models.SiteVisit, visit_mappings)
    if click_mappings:
        db.bulk_insert_mappings(models.ProductClick, click_mappings)
    if lia_mappings:
        db.bulk_insert_mappings(models.LiaInteraction, lia_mappings)
    db.commit()

    try:
        if "postgres" in str(db.bind.url):
            db.execute(text("SELECT setval(pg_get_serial_sequence('site_visits', 'id'), COALESCE(MAX(id), 1)) FROM site_visits;"))
            db.execute(text("SELECT setval(pg_get_serial_sequence('product_clicks', 'id'), COALESCE(MAX(id), 1)) FROM product_clicks;"))
            db.execute(text("SELECT setval(pg_get_serial_sequence('lia_interactions', 'id'), COALESCE(MAX(id), 1)) FROM lia_interactions;"))
            db.commit()
    except Exception as e:
        print(f"Sequence sync warning: {e}", flush=True)

    print(f"[OK] Injetados somando: +{len(visit_mappings)} visitas, +{len([c for c in click_mappings if c['click_type']=='shopee'])} shopee, +{len([c for c in click_mappings if c['click_type']=='site'])} compras site, +{len(lia_mappings)} lia!", flush=True)
    return {
        "status": "success",
        "added_visits": len(visit_mappings),
        "added_shopee": len([c for c in click_mappings if c['click_type']=='shopee']),
        "added_site_clicks": len([c for c in click_mappings if c['click_type']=='site']),
        "added_lia": len(lia_mappings),
        "daily_breakdown": {
            "visits": inc_visits,
            "shopee": inc_shopee,
            "site_clicks": inc_site,
            "lia": inc_lia,
        },
    }
