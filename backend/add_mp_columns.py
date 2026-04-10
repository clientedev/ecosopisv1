import sys
import os

# Add the current directory to the path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from app.core.database import SQLALCHEMY_DATABASE_URL

def add_columns():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    columns_to_add = [
        ("mercadopago_preference_id", "VARCHAR(255)"),
        ("mercadopago_payment_id", "VARCHAR(255)"),
        ("payment_method", "VARCHAR(50)")
    ]
    
    with engine.connect() as conn:
        for col_name, col_type in columns_to_add:
            try:
                print(f"Tentando adicionar coluna {col_name}...")
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"✅ Coluna {col_name} adicionada com sucesso.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicada" in str(e).lower():
                    print(f"ℹ️ Coluna {col_name} já existe.")
                else:
                    print(f"❌ Erro ao adicionar {col_name}: {e}")

if __name__ == "__main__":
    add_columns()
