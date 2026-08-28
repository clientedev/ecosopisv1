from app.core.database import SessionLocal
from app.models import models
def inspect():
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        print(f"--- USERS ({len(users)}) ---")
        for u in users:
            print(
                f"ID: {u.id} | Email: {u.email} | Role: {u.role} | "
                f"Compras: {u.total_compras or 0} | "
                f"Raspadinha usada em: {u.scratch_last_used_at}"
            )
            
        rewards = db.query(models.ScratchReward).order_by(models.ScratchReward.created_at.desc()).all()
        print(f"\n--- SCRATCHCARD REWARDS ({len(rewards)}) ---")
        for reward in rewards:
            print(
                f"ID: {reward.id} | User: {reward.user_id} | "
                f"Code: {reward.coupon_code} | Used: {reward.used}"
            )
            
        config = db.query(models.ScratchSettings).first()
        if config:
            print("\n--- SCRATCHCARD CONFIG ---")
            print(
                f"Enabled: {config.enabled} | Reward: "
                f"{config.reward_type} {config.reward_value} | "
                f"Validity: {config.coupon_valid_days} days"
            )
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
