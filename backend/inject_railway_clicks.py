import psycopg2
from psycopg2.extras import execute_values
import random
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone

DB_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"

PRODUCT_WEIGHTS = {
    1: 15, 2: 14, 3: 12, 13: 12, 14: 10, 15: 9, 27: 8, 25: 7, 26: 7,
    4: 6, 5: 6, 6: 6, 7: 5, 8: 5, 9: 5, 10: 5, 16: 4, 17: 4, 18: 4,
    21: 4, 22: 4, 23: 4, 42: 5, 11: 3, 12: 3, 19: 2, 20: 2, 24: 2,
    28: 2, 29: 2, 35: 2, 36: 2, 37: 2, 38: 3, 39: 2, 40: 2, 41: 2, 44: 2
}

def run_fast_injection():
    print("Gerando dados para injeção...", flush=True)
    products = list(PRODUCT_WEIGHTS.keys())
    weights = list(PRODUCT_WEIGHTS.values())
    
    records = []
    now = datetime.now(timezone.utc)
    
    # 2850 Shopee clicks
    for _ in range(2850):
        prod_id = random.choices(products, weights=weights, k=1)[0]
        day_offset = random.randint(0, 29)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        click_dt = now - timedelta(days=day_offset, hours=random.randint(0, 23), minutes=minute, seconds=second)
        records.append((prod_id, "shopee", click_dt))
        
    # 400 Site clicks
    for _ in range(400):
        prod_id = random.choices(products, weights=weights, k=1)[0]
        day_offset = random.randint(0, 29)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        click_dt = now - timedelta(days=day_offset, hours=random.randint(0, 23), minutes=minute, seconds=second)
        records.append((prod_id, "site", click_dt))
        
    records.sort(key=lambda x: x[2])
    print(f"Total de registros gerados: {len(records)}", flush=True)
    
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
    
    print("Inserindo dados via execute_values (ultra rápido)...", flush=True)
    query = "INSERT INTO product_clicks (product_id, click_type, created_at) VALUES %s"
    execute_values(cur, query, records)
    conn.commit()
    print("✅ Inserção concluída e commit realizado com sucesso!", flush=True)
    
    print("Sincronizando sequence de IDs do PostgreSQL...", flush=True)
    cur.execute("SELECT setval(pg_get_serial_sequence('product_clicks', 'id'), COALESCE(MAX(id), 1)) FROM product_clicks;")
    conn.commit()
    print("✅ Sequence de IDs sincronizada!", flush=True)
    
    cur.execute("SELECT click_type, COUNT(*) FROM product_clicks GROUP BY click_type;")
    summary = cur.fetchall()
    print("=== MÉTRICAS TOTAIS NO BANCO RAILWAY ===", flush=True)
    for ctype, count in summary:
        print(f" - {ctype}: {count} cliques", flush=True)
        
    cur.execute("SELECT COUNT(*) FROM product_clicks WHERE created_at >= NOW() - INTERVAL '30 days';")
    last_30d = cur.fetchone()[0]
    print(f" - Cliques nos últimos 30 dias: {last_30d}", flush=True)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    run_fast_injection()
