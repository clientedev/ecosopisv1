import sqlite3
import os

def upgrade_db():
    # Caminho do banco de dados (mesmo diretório do script)
    db_path = os.path.join(os.path.dirname(__file__), 'sql_app.db')
    print(f"Buscando DB em: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN is_wholesale BOOLEAN DEFAULT 0")
        print("Coluna 'is_wholesale' adicionada com sucesso na tabela 'products'.")
    except sqlite3.OperationalError as e:
        print(f"Atenção (talvez a coluna já exista): {e}")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    upgrade_db()
