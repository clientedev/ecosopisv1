from app.core.database import SessionLocal
from app.models import models
from app.core import security
import json

def test_registration():
    db = SessionLocal()
    try:
        print("Testing registration...")
        email = "test_diag@example.com"
        # Cleanup existing test user
        db.query(models.User).filter(models.User.email == email).delete()
        db.commit()
        
        hashed_password = security.get_password_hash("password123")
        new_user = models.User(
            email=email,
            hashed_password=hashed_password,
            full_name="Diag Test",
            role="client",
            pode_girar_roleta=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        print(f"Registration successful for user id: {new_user.id}")
        
        # Test login
        user = db.query(models.User).filter(models.User.email == email).first()
        if user and security.verify_password("password123", user.hashed_password):
            print("Login logic successful")
        else:
            print("Login logic failed")
            
    except Exception as e:
        print(f"DIAGNOSTIC FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_registration()
