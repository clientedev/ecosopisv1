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
                logger.warning(f"Could not add column {col_name}: {e}")
                try:
                    conn.rollback()
                except Exception:
                    pass

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
            logger.info("✓ Database seeding completed.")
        except Exception as seed_err:
            logger.warning(f"Seed skipped or partial: {seed_err}")

        logger.info("\n✓ All migrations completed successfully!")

    except Exception as e:
        logger.error(f"✗ Fatal error during migrations: {str(e)}")
        logger.exception("Full traceback:")
        success = False

    return success

if __name__ == "__main__":
    ok = run_migrations()
    sys.exit(0 if ok else 1)
