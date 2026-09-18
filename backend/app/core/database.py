import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# POSTGRES_URL / DATABASE_PUBLIC_URL take priority, then DATABASE_URL, then SQLite fallback
DATABASE_URL = (
    os.getenv("POSTGRES_URL")
    or os.getenv("DATABASE_PUBLIC_URL")
    or os.getenv("DATABASE_URL")
)
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Default to SQLite if no DATABASE_URL is provided (useful for local dev)
if not DATABASE_URL:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_file = os.path.join(backend_dir, "sql_app.db")
    DATABASE_URL = f"sqlite:///{db_file}"

if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL, 
        pool_pre_ping=True,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=15,
        max_overflow=25,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
