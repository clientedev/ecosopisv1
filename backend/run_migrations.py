from app.core.database import engine, Base, SessionLocal
from app.models import models
from seed import seed
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migrations():
    try:
        logger.info("Starting database migrations...")
        # Create tables
        Base.metadata.create_all(bind=engine)
        logger.info("Tables created successfully.")
        
        # Run seed
        logger.info("Starting data seeding...")
        seed()
        logger.info("Database seeding completed.")
        
    except Exception as e:
        logger.error(f"Error during migrations: {e}")
        raise e

if __name__ == "__main__":
    run_migrations()
