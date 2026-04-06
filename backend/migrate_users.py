import sqlite3
import os

def upgrade_users():
    db_path = os.path.join(os.path.dirname(__file__), 'sql_app.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns_to_add = [
        ("profile_picture", "VARCHAR"),
        ("can_post_news", "BOOLEAN DEFAULT 0"),
        ("total_compras", "INTEGER DEFAULT 0"),
        ("pode_girar_roleta", "BOOLEAN DEFAULT 0"),
        ("tentativas_roleta", "INTEGER DEFAULT 0"),
        ("ultimo_premio_id", "INTEGER")
    ]
    
    for col, dtype in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {dtype}")
            print(f"Adicionada coluna: {col}")
        except sqlite3.OperationalError as e:
            print(f"Ignorada coluna {col} (já existe ou falha): {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    upgrade_users()
