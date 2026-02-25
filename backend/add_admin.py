from app.core.database import SessionLocal
from app.models import models
from app.core.security import get_password_hash

db = SessionLocal()
user = db.query(models.User).filter(models.User.email == 'admin@ecosopis.com.br').first()
if not user:
    new_admin = models.User(
        email='admin@ecosopis.com.br',
        hashed_password=get_password_hash('admin123'),
        full_name='Admin Ecosopis',
        role='admin'
    )
    db.add(new_admin)
    db.commit()
    print("Admin admin@ecosopis.com.br / admin123 added successfully!")
else:
    print("Admin already exists.")
db.close()
