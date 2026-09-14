import psycopg2
from psycopg2.extras import execute_values
import random
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone

DB_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"

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

def update_railway_exact():
    print("Conectando ao PostgreSQL do Railway...", flush=True)
    result = urlparse(DB_URL)
    conn = psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port,
        sslmode='require'
    )
    cur = conn.cursor()

    # Get valid product IDs
    cur.execute("SELECT id FROM products;")
    products = [row[0] for row in cur.fetchall()]
    if not products:
        products = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    print("Limpando métricas antigas no Railway...", flush=True)
    cur.execute("TRUNCATE TABLE site_visits, product_clicks, lia_interactions RESTART IDENTITY;")
    conn.commit()

    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # 1. ULTIMOS 7 DIAS (VALORES EXATOS SOLICITADOS)
    # -------------------------------------------------------------
    visits_7d = 172
    shopee_7d = 70
    site_7d = 35
    lia_7d = 17

    visit_records = []
    click_records = []
    lia_records = []

    # Insert 7D records safely within the last 6 days (0.1 to 6.2 days ago)
    for _ in range(visits_7d):
        dt = now - timedelta(days=random.uniform(0.1, 6.2))
        visit_records.append((random.choice(PATHS), dt))

    for _ in range(shopee_7d):
        dt = now - timedelta(days=random.uniform(0.1, 6.2))
        click_records.append((random.choice(products), "shopee", dt))

    for _ in range(site_7d):
        dt = now - timedelta(days=random.uniform(0.1, 6.2))
        click_records.append((random.choice(products), "site", dt))

    for _ in range(lia_7d):
        dt = now - timedelta(days=random.uniform(0.1, 6.2))
        lia_records.append((None, random.choice(LIA_QUESTIONS), "Resposta da Lia...", random.choice(LIA_TOPICS), dt))

    # -------------------------------------------------------------
    # 2. HISTÓRICO ANTERIOR (DIAS 8 A 30) PARA 30D / 90D
    # -------------------------------------------------------------
    for day in range(8, 30):
        target_day = now - timedelta(days=day)
        num_v = random.randint(15, 25)
        num_s = random.randint(5, 10)
        num_c = random.randint(2, 6)
        num_l = random.randint(1, 4)

        for _ in range(num_v):
            dt = target_day - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            visit_records.append((random.choice(PATHS), dt))

        for _ in range(num_s):
            dt = target_day - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            click_records.append((random.choice(products), "shopee", dt))

        for _ in range(num_c):
            dt = target_day - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            click_records.append((random.choice(products), "site", dt))

        for _ in range(num_l):
            dt = target_day - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            lia_records.append((None, random.choice(LIA_QUESTIONS), "Resposta da Lia...", random.choice(LIA_TOPICS), dt))

    print(f"Inserindo {len(visit_records)} visitas no Railway...", flush=True)
    execute_values(cur, "INSERT INTO site_visits (path, created_at) VALUES %s", visit_records)

    print(f"Inserindo {len(click_records)} cliques no Railway...", flush=True)
    execute_values(cur, "INSERT INTO product_clicks (product_id, click_type, created_at) VALUES %s", click_records)

    print(f"Inserindo {len(lia_records)} interações LIA no Railway...", flush=True)
    execute_values(cur, "INSERT INTO lia_interactions (user_id, user_message, bot_response, topic, created_at) VALUES %s", lia_records)

    conn.commit()

    print("Sincronizando sequences de IDs no PostgreSQL...", flush=True)
    cur.execute("SELECT setval(pg_get_serial_sequence('site_visits', 'id'), COALESCE(MAX(id), 1)) FROM site_visits;")
    cur.execute("SELECT setval(pg_get_serial_sequence('product_clicks', 'id'), COALESCE(MAX(id), 1)) FROM product_clicks;")
    cur.execute("SELECT setval(pg_get_serial_sequence('lia_interactions', 'id'), COALESCE(MAX(id), 1)) FROM lia_interactions;")
    conn.commit()

    # Verify counts for last 7 days in PostgreSQL
    cur.execute("SELECT COUNT(*) FROM site_visits WHERE created_at >= NOW() - INTERVAL '7 days';")
    v7 = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM product_clicks WHERE click_type = 'shopee' AND created_at >= NOW() - INTERVAL '7 days';")
    s7 = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM product_clicks WHERE click_type = 'site' AND created_at >= NOW() - INTERVAL '7 days';")
    c7 = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lia_interactions WHERE created_at >= NOW() - INTERVAL '7 days';")
    l7 = cur.fetchone()[0]

    print(f"=== MÉTRICAS 7 DIAS CONFIRMADAS NO RAILWAY ===", flush=True)
    print(f" - Visitas no Site: {v7}", flush=True)
    print(f" - Saídas Shopee: {s7}", flush=True)
    print(f" - Cliques Comprar (Site): {c7}", flush=True)
    print(f" - Interações LIA: {l7}", flush=True)

    cur.close()
    conn.close()
    print("✅ Injeção no Railway finalizada com sucesso!", flush=True)

if __name__ == "__main__":
    update_railway_exact()
