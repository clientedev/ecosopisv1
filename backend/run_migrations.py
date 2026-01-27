from app.core.database import engine, Base, SessionLocal
from app.models import models
from seed import seed
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migrations():
    try:
        logger.info("Starting database migrations...")
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Tables created/updated successfully.")
        
        # Run seed data
        logger.info("Starting data seeding...")
        seed()
        logger.info("✓ Database seeding completed.")
        
        logger.info("\n✓ All migrations completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error during migrations: {str(e)}")
        logger.exception("Full traceback:")
        sys.exit(1)

if __name__ == "__main__":
    if run_migrations():
        sys.exit(0)
