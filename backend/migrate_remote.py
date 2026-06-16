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
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS \"order\" INTEGER DEFAULT 0;"))

        print("Adding missing columns to 'carousel_items' table if they don't exist...")
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS alignment VARCHAR DEFAULT 'left';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS title_color VARCHAR DEFAULT '#ffffff';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS description_color VARCHAR DEFAULT '#ffffff';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS badge_color VARCHAR DEFAULT '#ffffff';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS badge_bg_color VARCHAR DEFAULT '#4a7c59';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS overlay_color VARCHAR DEFAULT '#000000';"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS overlay_opacity FLOAT DEFAULT 0.3;"))
        conn.execute(text("ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS show_content BOOLEAN DEFAULT TRUE;"))
        
        print("Adding missing columns to 'product_details' table if they don't exist...")
        conn.execute(text("ALTER TABLE product_details ADD COLUMN IF NOT EXISTS beneficios TEXT;"))
        
        print("Ensuring system_settings, world_cup_matches, and world_cup_guesses tables exist...")
        conn.execute(text("CREATE TABLE IF NOT EXISTS system_settings (id SERIAL PRIMARY KEY, key VARCHAR UNIQUE NOT NULL, value TEXT, updated_at TIMESTAMPTZ DEFAULT now())"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS world_cup_matches (id SERIAL PRIMARY KEY, team_a VARCHAR DEFAULT 'Brasil', team_b VARCHAR NOT NULL, stadium VARCHAR, match_time TIMESTAMPTZ NOT NULL, score_a INTEGER, score_b INTEGER, is_finalized BOOLEAN DEFAULT FALSE, is_unlocked BOOLEAN DEFAULT FALSE, coupon_percentage DOUBLE PRECISION, created_at TIMESTAMPTZ DEFAULT now())"))
        conn.execute(text("ALTER TABLE world_cup_matches ADD COLUMN IF NOT EXISTS coupon_percentage DOUBLE PRECISION;"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS world_cup_guesses (id SERIAL PRIMARY KEY, match_id INTEGER NOT NULL REFERENCES world_cup_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), guess_score_a INTEGER NOT NULL, guess_score_b INTEGER NOT NULL, is_correct BOOLEAN, reward_coupon_code VARCHAR, is_processed BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT now())"))
        
        conn.commit()
    
    print("Creating any missing tables (e.g. roulette tables, product_details)...")
    models.Base.metadata.create_all(bind=engine)
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate_remote()
