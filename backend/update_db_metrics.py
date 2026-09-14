import random
from datetime import datetime, timedelta, timezone
from app.core.database import SessionLocal, engine, Base
from app.models import models

def update_metrics_exact():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        products = db.query(models.Product).all()
        if not products:
            print("Nenhum produto encontrado no banco para vincular os cliques.")
            return

        product_ids = [p.id for p in products]

        # Use UTC naive datetime matching DB timestamps
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

        print("Limpando registros antigos de métricas...")
        db.query(models.SiteVisit).delete()
        db.query(models.ProductClick).delete()
        db.query(models.LiaInteraction).delete()
        db.commit()

        print("Injetando métricas exatas e garantidas para os últimos 7 dias...")
        
        # 1. Exact targets for the last 7 days (placed safely within days 0 to 5, so no border truncation occurs)
        total_visits_7d = 172
        total_shopee_7d = 70
        total_site_7d = 35
        total_lia_7d = 17

        # Distribute across days 0..5 (recent 6 days)
        for i in range(total_visits_7d):
            day_offset = random.uniform(0.05, 5.8)
            r_time = now - timedelta(days=day_offset)
            db.add(models.SiteVisit(path=random.choice(paths), created_at=r_time))

        for i in range(total_shopee_7d):
            day_offset = random.uniform(0.05, 5.8)
            r_time = now - timedelta(days=day_offset)
            db.add(models.ProductClick(
                product_id=random.choice(product_ids),
                click_type="shopee",
                created_at=r_time
            ))

        for i in range(total_site_7d):
            day_offset = random.uniform(0.05, 5.8)
            r_time = now - timedelta(days=day_offset)
            db.add(models.ProductClick(
                product_id=random.choice(product_ids),
                click_type="site",
                created_at=r_time
            ))

        for i in range(total_lia_7d):
            day_offset = random.uniform(0.05, 5.8)
            r_time = now - timedelta(days=day_offset)
            db.add(models.LiaInteraction(
                user_message=random.choice(lia_questions),
                bot_response="Resposta da Lia...",
                topic=random.choice(lia_topics),
                created_at=r_time
            ))

        # 2. Historical Data for older period (days 8 to 30)
        for day in range(8, 30):
            date_target = now - timedelta(days=day)
            num_v = random.randint(15, 25)
            num_s = random.randint(5, 10)
            num_c = random.randint(2, 6)
            num_l = random.randint(1, 4)

            for _ in range(num_v):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.SiteVisit(path=random.choice(paths), created_at=r_time))

            for _ in range(num_s):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.ProductClick(
                    product_id=random.choice(product_ids),
                    click_type="shopee",
                    created_at=r_time
                ))

            for _ in range(num_c):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.ProductClick(
                    product_id=random.choice(product_ids),
                    click_type="site",
                    created_at=r_time
                ))

            for _ in range(num_l):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.LiaInteraction(
                    user_message=random.choice(lia_questions),
                    bot_response="Resposta da Lia...",
                    topic=random.choice(lia_topics),
                    created_at=r_time
                ))

        db.commit()
        print("Métricas injetadas com garantia total de precisão!")

    except Exception as e:
        db.rollback()
        print(f"Erro ao injetar métricas: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_metrics_exact()
