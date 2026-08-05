import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal, engine, Base
from app.models import models
from app.main import _apply_startup_migrations, _ensure_extra_tables

def run_tests():
    print("--- 1. Testing DB Migrations ---")
    _apply_startup_migrations()
    _ensure_extra_tables()
    Base.metadata.create_all(bind=engine)
    print("[OK] DB Migrations executed successfully.")

    db = SessionLocal()
    try:
        print("\n--- 2. Testing Scratchcard Settings ---")
        settings = db.query(models.ScratchSettings).first()
        assert settings is not None, "ScratchSettings should exist"
        print(f"[OK] Settings found: Enabled={settings.enabled}, Type={settings.reward_type}, Value={settings.reward_value}, Prefix={settings.coupon_prefix}")

        print("\n--- 3. Testing Scratchcard Flow ---")
        # Create test user
        test_email = f"scratch_test_{int(datetime.now().timestamp())}@test.com"
        user = models.User(
            email=test_email,
            hashed_password="fakehashpassword",
            full_name="Test Scratch User",
            role="client",
            scratch_used=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        assert user.scratch_used == False, "New user scratch_used must be False"
        print(f"[OK] Created test user ID {user.id} with scratch_used=False")

        # Simulate play logic
        from app.api.endpoints.scratchcard import play_scratchcard
        res = play_scratchcard(db=db, current_user=user)
        print(f"[OK] Scratchcard played successfully! Coupon generated: {res.coupon_code}")

        # Refresh user from DB
        db.refresh(user)
        assert user.scratch_used == True, "User scratch_used must now be True"
        assert user.scratch_reward_id is not None, "User scratch_reward_id must be populated"
        print(f"[OK] User scratch_used is now True (Reward ID: {user.scratch_reward_id})")

        # Verify coupon in coupons table
        coupon = db.query(models.Coupon).filter(models.Coupon.code == res.coupon_code).first()
        assert coupon is not None, "Coupon must exist in coupons table"
        assert coupon.discount_type == settings.reward_type
        assert coupon.usage_limit == 1
        print(f"[OK] Coupon verified in DB: Code={coupon.code}, UsageLimit={coupon.usage_limit}, Type={coupon.discount_type}")

        # Verify second play attempt fails
        try:
            play_scratchcard(db=db, current_user=user)
            print("[ERROR] Second play attempt should have failed!")
        except Exception as e:
            print(f"[OK] Second play attempt blocked correctly: {e.detail if hasattr(e, 'detail') else e}")

        print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
