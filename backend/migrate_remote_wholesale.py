import psycopg2

URL = "postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway"

def migrate():
    conn = psycopg2.connect(URL, sslmode='require')
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Adicionando o campo de atacado
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN is_wholesale BOOLEAN DEFAULT FALSE;")
        print("Sucesso: Coluna 'is_wholesale' adicionada na tabela 'products'.")
    except Exception as e:
        print(f"Atenção: Coluna 'is_wholesale' provavelmente já existe. Erro original: {e}")

    # Restauração das colunas de usuários do histórico recente
    columns_users = [
        ("profile_picture", "VARCHAR"),
        ("can_post_news", "BOOLEAN DEFAULT FALSE"),
        ("total_compras", "INTEGER DEFAULT 0"),
        ("pode_girar_roleta", "BOOLEAN DEFAULT FALSE"),
        ("tentativas_roleta", "INTEGER DEFAULT 0"),
        ("ultimo_premio_id", "INTEGER")
    ]
    
    for col, dtype in columns_users:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {dtype};")
            print(f"Sucesso: {col} em users.")
        except Exception as e:
            print(f"Ignorado {col} (provavelmente já existe): {e}")

    conn.close()

if __name__ == "__main__":
    migrate()
