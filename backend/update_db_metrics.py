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

        # Use naive UTC datetime
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

        print("Injetando métricas exatas para os últimos 7 dias...")
        # Target for Last 7 Days (days 0 to 6):
        # Visitas Site: 172
        # Saídas Shopee: 70
        # Cliques Comprar (Site): 35
        # Interações LIA: 17

        # Distribute targets across the 7 days (day 0 is today, day 6 is 6 days ago)
        # We assign daily proportions that sum up to EXACT targets
        def distribute_counts(total, days=7):
            base = total // days
            remainder = total % days
            counts = [base] * days
            for i in range(remainder):
                counts[i] += 1
            random.shuffle(counts)
            return counts

        visits_7d = distribute_counts(172, 7)
        shopee_7d = distribute_counts(70, 7)
        site_7d = distribute_counts(35, 7)
        lia_7d = distribute_counts(17, 7)

        # 1. Insert Last 7 Days (exact totals)
        for day in range(7):
            date_target = now - timedelta(days=day)

            # Visits
            for _ in range(visits_7d[day]):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.SiteVisit(path=random.choice(paths), created_at=r_time))

            # Shopee Clicks
            for _ in range(shopee_7d[day]):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.ProductClick(
                    product_id=random.choice(product_ids),
                    click_type="shopee",
                    created_at=r_time
                ))

            # Site Buy Clicks
            for _ in range(site_7d[day]):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.ProductClick(
                    product_id=random.choice(product_ids),
                    click_type="site",
                    created_at=r_time
                ))

            # Lia Interactions
            for _ in range(lia_7d[day]):
                r_time = date_target - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                db.add(models.LiaInteraction(
                    user_message=random.choice(lia_questions),
                    bot_response="Resposta personalizada da Lia...",
                    topic=random.choice(lia_topics),
                    created_at=r_time
                ))

        # 2. Insert Historical Data (days 7 to 30) for 30d/90d views
        for day in range(7, 30):
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
        print("Métricas injetadas com sucesso!")

    except Exception as e:
        db.rollback()
        print(f"Erro ao injetar métricas: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_metrics_exact()
