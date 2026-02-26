import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Path to .env (adjust if needed)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    # Try to find local sqlite
    if os.path.exists("sql_app.db"):
        DATABASE_URL = "sqlite:///./sql_app.db"
    elif os.path.exists("backend/sql_app.db"):
        DATABASE_URL = "sqlite:///./backend/sql_app.db"
    else:
        print("Erro: DATABASE_URL n\u00e3o definida e sql_app.db n\u00e3o encontrado.")
        sys.exit(1)

print(f"Conectando ao banco de dados...")
try:
    engine = create_engine(DATABASE_URL)
    
    columns = [
        ("vertical_alignment", "TEXT", "'center'"),
        ("content_max_width", "TEXT", "'500px'"),
        ("glassmorphism", "BOOLEAN", "0")
    ]

    with engine.connect() as conn:
        for col_name, col_type, default_val in columns:
            try:
                print(f"Adicionando coluna {col_name}...")
                conn.execute(text(f"ALTER TABLE carousel_items ADD COLUMN {col_name} {col_type} DEFAULT {default_val}"))
                conn.commit()
                print(f"Coluna {col_name} adicionada.")
            except Exception as e:
                # Basic check for "already exists" errors (DB specific strings)
                err_str = str(e).lower()
                if "already exists" in err_str or "duplicate column" in err_str:
                    print(f"A coluna {col_name} j\u00e1 existe, pulando.")
                else:
                    print(f"Erro ao adicionar {col_name}: {e}")

    print("Migra\u00e7\u00e3o conclu\u00edda!")

except Exception as e:
    print(f"Erro fatal: {e}")
    sys.exit(1)
