from sqlalchemy import create_engine, text
import time

URL1 = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"
URL2 = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway?sslmode=disable"
URL3 = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway?sslmode=require"

def run_migration():
    for url in [URL1, URL2, URL3]:
        print(f"Trying URL: {'default' if '?' not in url else url.split('?')[1]}")
        engine = create_engine(url, connect_args={"connect_timeout": 5})
        try:
            with engine.connect() as conn:
                print("==> CONNECTED SUCCESSFULLY!")
                queries = [
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_news BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_on_site BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE products ADD COLUMN IF NOT EXISTS mercadolivre_url VARCHAR;",
                    "ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_url VARCHAR;"
                ]
                for q in queries:
                    try:
                        conn.execute(text(q))
                        print(f" ✓ Executed: {q.split('EXISTS ')[1]}")
                    except Exception as e:
                        print(f" - Error on {q}: {e}")
                conn.commit()
            print("==> MIGRATION APPLIED!")
            return
        except Exception as e:
            print(f"Connection failed: {str(e).split('Background on this error')[0]}")
            time.sleep(2)

if __name__ == "__main__":
    run_migration()
