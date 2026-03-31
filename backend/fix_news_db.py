import psycopg2
from urllib.parse import urlparse

DATABASE_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"

def fix_db():
    print("Connecting to remote database with SSL...")
    parsed_url = urlparse(DATABASE_URL)
    try:
        conn = psycopg2.connect(
            dbname=parsed_url.path[1:],
            user=parsed_url.username,
            password=parsed_url.password,
            host=parsed_url.hostname,
            port=parsed_url.port,
            sslmode='require'
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Checking/adding column 'media_url' to 'news'...")
        try:
            cur.execute("ALTER TABLE news ADD COLUMN IF NOT EXISTS media_url VARCHAR;")
            print("Successfully added/verified 'media_url'.")
        except Exception as e:
            print(f"Error adding 'media_url': {e}")
            
        print("Checking/adding column 'media_type' to 'news'...")
        try:
            cur.execute("ALTER TABLE news ADD COLUMN IF NOT EXISTS media_type VARCHAR;")
            print("Successfully added/verified 'media_type'.")
        except Exception as e:
            print(f"Error adding 'media_type': {e}")

        print("Checking/adding column 'can_post_news' to 'users'...")
        try:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_news BOOLEAN DEFAULT FALSE;")
            print("Successfully added/verified 'can_post_news'.")
        except Exception as e:
            print(f"Error adding 'can_post_news': {e}")
            
        print("Checking/adding column 'role' to 'users' if missing...")
        try:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'client';")
            print("Successfully added/verified 'role'.")
        except Exception as e:
            pass

        cur.close()
        conn.close()
        print("Database schema fix completed successfully!")

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    fix_db()
