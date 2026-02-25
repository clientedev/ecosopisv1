from app.core.database import SessionLocal, engine
from app.models import models
from sqlalchemy import text

def seed_prizes():
    # Run manual migration for new columns
    with engine.connect() as conn:
        for col, defn in [("discount_type", "VARCHAR"), ("discount_value", "FLOAT")]:
            try:
                conn.execute(text(f"ALTER TABLE roulette_prizes ADD COLUMN {col} {defn}"))
                conn.commit()
            except Exception as e:
                # Column likely already exists
                pass

    db = SessionLocal()
    try:
        # Clear existing prizes to avoid duplicates during testing
        db.query(models.RoulettePrize).delete()
        
        prizes = [
            models.RoulettePrize(
                nome="10% de Desconto",
                descricao="Ganhe 10% de desconto na sua próxima compra!",
                ativo=True,
                selecionado_para_sair=True,
                discount_type="percentage",
                discount_value=10.0
            ),
            models.RoulettePrize(
                nome="R$ 20,00 OFF",
                descricao="Desconto de 20 reais em compras acima de R$ 100!",
                ativo=True,
                selecionado_para_sair=True,
                discount_type="fixed",
                discount_value=20.0
            ),
            models.RoulettePrize(
                nome="Frete Grátis",
                descricao="Use seu cupom para frete grátis em todo o site!",
                ativo=True,
                selecionado_para_sair=True,
                discount_type="percentage",
                discount_value=100.0 # Simulating 100% off (can be handled specifically if needed)
            ),
            models.RoulettePrize(
                nome="Brinde Surpresa",
                descricao="Um sérum facial exclusivo na sua caixa!",
                ativo=True,
                selecionado_para_sair=True,
                discount_type=None,
                discount_value=None
            )
        ]
        
        db.add_all(prizes)
        
        # Ensure roulette is active for the teaser
        config = db.query(models.RouletteConfig).first()
        if not config:
            config = models.RouletteConfig(ativa=True, popup_ativo=True, regra_novo_usuario=True)
            db.add(config)
        else:
            config.ativa = True
            config.popup_ativo = True
            config.regra_novo_usuario = True
            
        db.commit()
        print("Prizes seeded successfully!")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_prizes()
