import os
from sqlalchemy import create_engine, text
from app.models import models

# Remote Railway PostgreSQL URL
DATABASE_URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway?sslmode=require"

def migrate_remote():
    print(f"Connecting to remote database at {DATABASE_URL.split('@')[-1]}...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Adding missing columns to 'users' table if they don't exist...")
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_compras INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS pode_girar_roleta BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS tentativas_roleta INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_premio_id INTEGER;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_news BOOLEAN DEFAULT FALSE;"))
        
        print("Adding missing columns to 'products' table if they don't exist...")
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_on_site BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS mercadolivre_url VARCHAR;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_url VARCHAR;"))

        print("Adding missing columns to 'carousel_items' table if they don't exist...")
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS alignment VARCHAR DEFAULT 'left';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS title_color VARCHAR DEFAULT '#ffffff';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS description_color VARCHAR DEFAULT '#ffffff';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS badge_color VARCHAR DEFAULT '#ffffff';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS badge_bg_color VARCHAR DEFAULT '#4a7c59';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS overlay_color VARCHAR DEFAULT '#000000';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS overlay_opacity FLOAT DEFAULT 0.3;"))
        
        conn.commit()
    
    print("Creating any missing tables (e.g. roulette tables, product_details)...")
    models.Base.metadata.create_all(bind=engine)
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate_remote()
