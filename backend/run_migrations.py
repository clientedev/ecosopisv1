from app.core.database import engine, Base, SessionLocal
from app.models import models
from seed import seed
import logging
import sys
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Columns that were added to models AFTER the table was first created.
# PostgreSQL's ALTER TABLE ADD COLUMN IF NOT EXISTS is idempotent (safe to re-run).
MISSING_CAROUSEL_COLUMNS = [
    ("alignment",         "VARCHAR DEFAULT 'left'"),
    ("title_color",       "VARCHAR DEFAULT '#ffffff'"),
    ("description_color", "VARCHAR DEFAULT '#ffffff'"),
    ("badge_color",       "VARCHAR DEFAULT '#ffffff'"),
    ("badge_bg_color",    "VARCHAR DEFAULT '#4a7c59'"),
    ("overlay_color",     "VARCHAR DEFAULT '#000000'"),
    ("overlay_opacity",   "DOUBLE PRECISION DEFAULT 0.3"),
]

MISSING_ANNOUNCEMENT_COLUMNS = [
    ("is_scrolling", "BOOLEAN DEFAULT FALSE"),
    ("repeat_text",  "BOOLEAN DEFAULT TRUE"),
    ("scroll_speed", "INTEGER DEFAULT 20"),
]

MISSING_USERS_COLUMNS = [
    ("profile_picture", "VARCHAR"),
    ("can_post_news", "BOOLEAN DEFAULT FALSE"),
    ("total_compras", "INTEGER DEFAULT 0"),
    ("pode_girar_roleta", "BOOLEAN DEFAULT FALSE"),
    ("tentativas_roleta", "INTEGER DEFAULT 0"),
    ("ultimo_premio_id", "INTEGER"),
]

MISSING_PRODUCTS_COLUMNS = [
    ("buy_on_site", "BOOLEAN DEFAULT TRUE"),
    ("is_wholesale", "BOOLEAN DEFAULT FALSE"),
    ("mercadolivre_url", "VARCHAR"),
    ("shopee_url", "VARCHAR"),
]


def add_missing_columns():
    """Safely add any columns that don't exist yet in the live database."""
    with engine.connect() as conn:
        for col_name, col_def in MISSING_CAROUSEL_COLUMNS:
            try:
                conn.execute(text(
                    f"ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
                conn.commit()
                logger.info(f"✓ Column carousel_items.{col_name} ensured.")
            except Exception as e:
                logger.warning(f"Could not add column carousel_items.{col_name}: {e}")
                try: conn.rollback()
                except Exception: pass

        for col_name, col_def in MISSING_ANNOUNCEMENT_COLUMNS:
            try:
                conn.execute(text(
                    f"ALTER TABLE announcement_bar ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
                conn.commit()
                logger.info(f"✓ Column announcement_bar.{col_name} ensured.")
            except Exception as e:
                logger.warning(f"Could not add column announcement_bar.{col_name}: {e}")
                try: conn.rollback()
                except Exception: pass

        for col_name, col_def in MISSING_USERS_COLUMNS:
            try:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
                conn.commit()
                logger.info(f"✓ Column users.{col_name} ensured.")
            except Exception as e:
                logger.warning(f"Could not add column users.{col_name}: {e}")
                try: conn.rollback()
                except Exception: pass

        for col_name, col_def in MISSING_PRODUCTS_COLUMNS:
            try:
                conn.execute(text(
                    f"ALTER TABLE products ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
                conn.commit()
                logger.info(f"✓ Column products.{col_name} ensured.")
            except Exception as e:
                logger.warning(f"Could not add column products.{col_name}: {e}")
                try: conn.rollback()
                except Exception: pass

def run_migrations():
    success = True
    try:
        logger.info("Starting database migrations...")
        # Create all tables (new tables only; does NOT modify existing tables)
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Tables created successfully.")

        # Manually add columns that exist in models but not yet in the DB
        logger.info("Ensuring all required columns exist...")
        add_missing_columns()
        logger.info("✓ Column migrations complete.")

        # Run seed data
        logger.info("Starting data seeding...")
        try:
            seed()
            logger.info("✓ Database seeding completed successfully.")
        except Exception as seed_err:
            logger.error(f"✗ Seed failed: {seed_err}")
            # If seeding fails, we still want to continue to start the app
            # unless it's a fatal connection error

        logger.info("\n✓ All migrations completed successfully!")

    except Exception as e:
        logger.error(f"✗ Fatal error during migrations: {str(e)}")
        logger.exception("Full traceback:")
        success = False

    return success

if __name__ == "__main__":
    ok = run_migrations()
    sys.exit(0 if ok else 1)
