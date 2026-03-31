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
        sslmode='require'  # adding sslmode require usually fixes this
    )
    cur = conn.cursor()
    cur.execute("SELECT id, email, role, can_post_news FROM users;")
    rows = cur.fetchall()
    for row in rows:
        print(f"ID: {row[0]}, Email: {row[1]}, Role: {row[2]}, Can Post: {row[3]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error connecting: {e}")
