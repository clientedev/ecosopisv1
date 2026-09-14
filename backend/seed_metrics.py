import os
import random
from datetime import datetime, timedelta, timezone
from app.core.database import SessionLocal, engine, Base
from app.models import models

def seed_metrics():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check existing products
        products = db.query(models.Product).all()
        if not products:
            print("No products found in DB. Aborting metrics seed.")
            return

        product_ids = [p.id for p in products]

        # Target timeline: last 30 days
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        paths = [
            "/", "/", "/", "/produto/sabonete-acafrao-dolomita",
            "/produto/kit-clareamento", "/quizz", "/lia", "/atacado"
        ]

        lia_topics = [
            "Rotina para Pele Oleosa", "Modo de Uso Sabonete Açafrão",
            "Prazo de Envio / Frete", "Benefícios da Rosa Mosqueta",
            "Melhor produto para manchas", "Dúvidas sobre Atacado"
        ]

        lia_questions = [
            "Como usar o sabonete de açafrão no rosto?",
            "Qual produto é melhor para clarear manchas de acne?",
            "Qual o prazo de entrega para São Paulo?",
            "O óleo de rosa mosqueta pode ser usado de dia?",
            "Vocês vendem no atacado para revenda?"
        ]

        print("Seeding metrics data for the last 30 days...")

        # Clear old metrics if any
        db.query(models.SiteVisit).delete()
        db.query(models.ProductClick).delete()
        db.query(models.LiaInteraction).delete()
        db.commit()

        # Seed data day by day
        for day in range(30, -1, -1):
            date_target = now - timedelta(days=day)
            
            # Weighted distribution (higher in recent 7 days)
            multiplier = 1.3 if day <= 7 else 0.8
            
            num_visits = int(random.randint(20, 35) * multiplier)
            num_shopee = int(random.randint(8, 15) * multiplier)
            num_site = int(random.randint(4, 9) * multiplier)
            num_lia = int(random.randint(2, 5) * multiplier)

            # Ensure exact minimum targets for today / last 7 days
            if day == 0:
                num_shopee = max(num_shopee, 70)
                num_visits = max(num_visits, 172)
                num_lia = max(num_lia, 17)

            # 1. Site Visits
            for _ in range(num_visits):
                random_time = date_target + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.SiteVisit(
                    path=random.choice(paths),
                    created_at=random_time
                ))

            # 2. Shopee Clicks
            for _ in range(num_shopee):
                random_time = date_target + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.ProductClick(
                    product_id=random.choice(product_ids),
                    click_type="shopee",
                    created_at=random_time
                ))

            # 3. Site Buy Clicks
            for _ in range(num_site):
                random_time = date_target + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.ProductClick(
                    product_id=random.choice(product_ids),
                    click_type="site",
                    created_at=random_time
                ))

            # 4. Lia Interactions
            for _ in range(num_lia):
                random_time = date_target + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.LiaInteraction(
                    user_message=random.choice(lia_questions),
                    bot_response="Resposta personalizada da Lia...",
                    topic=random.choice(lia_topics),
                    created_at=random_time
                ))

        db.commit()
        print("Metrics seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding metrics: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_metrics()
