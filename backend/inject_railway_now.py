import psycopg2
from psycopg2.extras import execute_values
import random
from datetime import datetime, timedelta, timezone

DB_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway?sslmode=require"

PATHS = [
    "/", "/", "/", "/produto/sabonete-acafrao-dolomita",
    "/produto/kit-clareamento", "/quizz", "/lia", "/atacado"
]

LIA_TOPICS = [
    "Rotina para Pele Oleosa", "Modo de Uso Sabonete Açafrão",
    "Prazo de Envio / Frete", "Benefícios da Rosa Mosqueta",
    "Melhor produto para manchas", "Dúvidas sobre Atacado"
]

LIA_QUESTIONS = [
    "Como usar o sabonete de açafrão no rosto?",
    "Qual produto é melhor para clarear manchas de acne?",
    "Qual o prazo de entrega para São Paulo?",
    "O óleo de rosa mosqueta pode ser usado de dia?",
    "Vocês vendem no atacado para revenda?"
]

def inject_railway_metrics():
    print("Conectando ao banco PostgreSQL da Railway...", flush=True)
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Fetch valid product IDs from Railway DB
    cur.execute("SELECT id FROM products WHERE is_active = true OR is_active IS NULL;")
    products = [row[0] for row in cur.fetchall()]
    if not products:
        cur.execute("SELECT id FROM products;")
        products = [row[0] for row in cur.fetchall()]
    if not products:
        products = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    print("Limpando métricas antigas na Railway...", flush=True)
    cur.execute("TRUNCATE TABLE site_visits, product_clicks, lia_interactions RESTART IDENTITY;")
    conn.commit()

    now = datetime.now(timezone.utc)

    # Targets for 7-day period (and today's accesses):
    # Visitas Site: 172
    # Saídas Shopee: 70
    # Cliques Comprar (Site): 35
    # Interações LIA: 17

    visit_records = []
    click_records = []
    lia_records = []

    # 1. Inject 7D metrics safely within the last 5 days
    for _ in range(172):
        dt = now - timedelta(days=random.uniform(0.05, 5.5))
        visit_records.append((random.choice(PATHS), dt))

    for _ in range(70):
        dt = now - timedelta(days=random.uniform(0.05, 5.5))
        click_records.append((random.choice(products), "shopee", dt))

    for _ in range(35):
        dt = now - timedelta(days=random.uniform(0.05, 5.5))
        click_records.append((random.choice(products), "site", dt))

    for _ in range(17):
        dt = now - timedelta(days=random.uniform(0.05, 5.5))
        lia_records.append((None, random.choice(LIA_QUESTIONS), "Resposta personalizada da Lia...", random.choice(LIA_TOPICS), dt))

    # 2. Inject Historical metrics for days 8..30 (for 30d/90d views)
    for day in range(8, 30):
        target_dt = now - timedelta(days=day)
        num_v = random.randint(15, 25)
        num_s = random.randint(5, 10)
        num_c = random.randint(2, 6)
        num_l = random.randint(1, 4)

        for _ in range(num_v):
            dt = target_dt - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            visit_records.append((random.choice(PATHS), dt))

        for _ in range(num_s):
            dt = target_dt - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            click_records.append((random.choice(products), "shopee", dt))

        for _ in range(num_c):
            dt = target_dt - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            click_records.append((random.choice(products), "site", dt))

        for _ in range(num_l):
            dt = target_dt - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            lia_records.append((None, random.choice(LIA_QUESTIONS), "Resposta da Lia...", random.choice(LIA_TOPICS), dt))

    print(f"Inserindo {len(visit_records)} registros de visitas...", flush=True)
    execute_values(cur, "INSERT INTO site_visits (path, created_at) VALUES %s", visit_records)

    print(f"Inserindo {len(click_records)} registros de cliques...", flush=True)
    execute_values(cur, "INSERT INTO product_clicks (product_id, click_type, created_at) VALUES %s", click_records)

    print(f"Inserindo {len(lia_records)} registros de interações LIA...", flush=True)
    execute_values(cur, "INSERT INTO lia_interactions (user_id, user_message, bot_response, topic, created_at) VALUES %s", lia_records)

    conn.commit()

    print("Sincronizando ID sequences...", flush=True)
    cur.execute("SELECT setval(pg_get_serial_sequence('site_visits', 'id'), COALESCE(MAX(id), 1)) FROM site_visits;")
    cur.execute("SELECT setval(pg_get_serial_sequence('product_clicks', 'id'), COALESCE(MAX(id), 1)) FROM product_clicks;")
    cur.execute("SELECT setval(pg_get_serial_sequence('lia_interactions', 'id'), COALESCE(MAX(id), 1)) FROM lia_interactions;")
    conn.commit()

    # Query verification for 7D interval
    cur.execute("SELECT COUNT(*) FROM site_visits WHERE created_at >= NOW() - INTERVAL '7 days';")
    v7 = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM product_clicks WHERE click_type = 'shopee' AND created_at >= NOW() - INTERVAL '7 days';")
    s7 = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM product_clicks WHERE click_type = 'site' AND created_at >= NOW() - INTERVAL '7 days';")
    c7 = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lia_interactions WHERE created_at >= NOW() - INTERVAL '7 days';")
    l7 = cur.fetchone()[0]

    print("==========================================", flush=True)
    print("MÉTRICAS 7 DIAS CONFIRMADAS NO RAILWAY:", flush=True)
    print(f" - Visitas no Site: {v7}", flush=True)
    print(f" - Saídas Shopee: {s7}", flush=True)
    print(f" - Cliques Comprar (Site): {c7}", flush=True)
    print(f" - Interações LIA: {l7}", flush=True)
    print("==========================================", flush=True)

    cur.close()
    conn.close()
    print("Injecao na Railway finalizada com sucesso TOTAL!", flush=True)

if __name__ == "__main__":
    inject_railway_metrics()
