import sqlite3
import os
import sys

# Try to find the database
db_path = "sql_app.db"
if not os.path.exists(db_path):
    # Try relative from current dir if called from root
    db_path = "backend/sql_app.db"

if not os.path.exists(db_path):
    print(f"Erro: Banco de dados n\u00e3o encontrado em {db_path}")
    sys.exit(1)

print(f"Conectando ao banco de dados: {db_path}")
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Columns to add
    columns = [
        ("vertical_alignment", "TEXT DEFAULT 'center'"),
        ("content_max_width", "TEXT DEFAULT '500px'"),
        ("glassmorphism", "BOOLEAN DEFAULT 0")
    ]

    for col_name, col_type in columns:
        try:
            print(f"Adicionando coluna {col_name}...")
            cursor.execute(f"ALTER TABLE carousel_items ADD COLUMN {col_name} {col_type}")
            print(f"Coluna {col_name} adicionada com sucesso.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"A coluna {col_name} j\u00e1 existe, pulando.")
            else:
                print(f"Erro ao adicionar {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Migra\u00e7\u00e3o conclu\u00edda!")

except Exception as e:
    print(f"Erro fatal: {e}")
    sys.exit(1)
