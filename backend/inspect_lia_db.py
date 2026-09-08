import psycopg2
from urllib.parse import urlparse

db_url = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"
result = urlparse(db_url)

try:
    conn = psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port,
        sslmode='require'
    )
    cur = conn.cursor()
    
    print("=== CURRENT LIA INTERACTIONS IN RAILWAY DB ===")
    cur.execute("SELECT count(*), min(created_at), max(created_at) FROM lia_interactions;")
    stats = cur.fetchone()
    print("Total rows:", stats[0], "| Min date:", stats[1], "| Max date:", stats[2])
    
    cur.execute("SELECT id, user_message, topic, created_at FROM lia_interactions ORDER BY created_at DESC LIMIT 5;")
    rows = cur.fetchall()
    print("\nRecent interactions:")
    for r in rows:
        print(f"ID {r[0]} | Topic: {r[2]} | Msg: {r[1][:50]}... | Date: {r[3]}")
        
    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)
