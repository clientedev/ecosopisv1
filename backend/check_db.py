from app.core.database import SessionLocal
from app.models import models

db = SessionLocal()
try:
    news = db.query(models.News).all()
    print(f"Total news posts: {len(news)}")
    for n in news:
        print(f"ID: {n.id}, User ID: {n.user_id}, Title: {n.title}")
        if n.user_id is None:
            print(f"  !!! CRITICAL: user_id is None for post {n.id}")
            # Fix it by assigning to the first admin if exists
            admin = db.query(models.User).filter(models.User.role == "admin").first()
            if admin:
                print(f"  Fixing post {n.id}... setting user_id to {admin.id}")
                n.user_id = admin.id
            else:
                print(f"  Could not fix post {n.id}: No admin user found.")
    db.commit()
    print("Database check complete.")
finally:
    db.close()
