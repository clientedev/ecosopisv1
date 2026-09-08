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
    
    print("=== PRODUCTS IN RAILWAY DB ===")
    cur.execute("SELECT id, name, buy_on_site, shopee_url FROM products ORDER BY id;")
    products = cur.fetchall()
    for p in products:
        print(f"ID: {p[0]} | Name: {p[1]} | BuyOnSite: {p[2]} | ShopeeURL: {p[3]}")
    
    print("\n=== CURRENT PRODUCT CLICKS IN RAILWAY DB ===")
    cur.execute("SELECT count(*), click_type FROM product_clicks GROUP BY click_type;")
    clicks_summary = cur.fetchall()
    print("Clicks summary:", clicks_summary)
    
    cur.execute("SELECT min(created_at), max(created_at), count(*) FROM product_clicks;")
    stats = cur.fetchone()
    print("Min created_at:", stats[0], "| Max created_at:", stats[1], "| Total clicks:", stats[2])
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error connecting: {e}")
