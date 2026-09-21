import os
import sys
import logging
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrate_google_auth")

def migrate_google_auth():
    logger.info("Verificando colunas de autenticação Google na tabela users...")
    with engine.connect() as conn:
        is_sqlite = conn.dialect.name == "sqlite"
        
        # 1. Add google_id column
        try:
            if is_sqlite:
                res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
                cols = [r[1] for r in res]
                if "google_id" not in cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN "google_id" VARCHAR'))
                    conn.commit()
                    logger.info("✓ Coluna 'google_id' adicionada na tabela users.")
                else:
                    logger.info("✓ Coluna 'google_id' já existe na tabela users.")
            else:
                conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS "google_id" VARCHAR'))
                conn.commit()
                logger.info("✓ Coluna 'google_id' garantida na tabela users (Postgres).")
        except Exception as e:
            logger.warning(f"Erro ao adicionar coluna google_id: {e}")
            try: conn.rollback()
            except Exception: pass

        # 2. Add auth_provider column
        try:
            if is_sqlite:
                res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
                cols = [r[1] for r in res]
                if "auth_provider" not in cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN "auth_provider" VARCHAR DEFAULT \'local\''))
                    conn.commit()
                    logger.info("✓ Coluna 'auth_provider' adicionada na tabela users.")
                else:
                    logger.info("✓ Coluna 'auth_provider' já existe na tabela users.")
            else:
                conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS "auth_provider" VARCHAR DEFAULT \'local\''))
                conn.commit()
                logger.info("✓ Coluna 'auth_provider' garantida na tabela users (Postgres).")
        except Exception as e:
            logger.warning(f"Erro ao adicionar coluna auth_provider: {e}")
            try: conn.rollback()
            except Exception: pass

        # 3. Add index on google_id
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id)"))
            conn.commit()
            logger.info("✓ Índice 'idx_users_google_id' criado/garantido.")
        except Exception as e:
            logger.warning(f"Erro ao criar índice idx_users_google_id: {e}")
            try: conn.rollback()
            except Exception: pass

    logger.info("Migração de autenticação Google concluída com sucesso!")

if __name__ == "__main__":
    migrate_google_auth()
