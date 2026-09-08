import psycopg2
from urllib.parse import urlparse

DB_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"

def sync_seq():
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
    
    cur.execute("SELECT setval(pg_get_serial_sequence('product_clicks', 'id'), COALESCE(MAX(id), 1)) FROM product_clicks;")
    conn.commit()
    print("Sequence successfully updated.")
    
    cur.execute("SELECT nextval(pg_get_serial_sequence('product_clicks', 'id'));")
    next_id = cur.fetchone()[0]
    print(f"Next ID test sequence will generate: {next_id}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    sync_seq()
