import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal, engine, Base
from app.models import models
from app.api.endpoints import metrics

def test_bi_endpoint():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Test creating dummy admin user
        admin = db.query(models.User).filter_by(role="admin").first()
        if not admin:
            admin = models.User(email="testadmin@ecosopis.com", hashed_password="pw", role="admin")
            db.add(admin)
            db.commit()

        # Call get_bi_analytics function directly
        res = metrics.get_bi_analytics(
            period="30d",
            shopee_offset=5400,
            site_revenue_offset=14500.0,
            visits_offset=8900,
            lia_chats_offset=420,
            db=db,
            current_admin=admin
        )
        print("✓ BI Analytics test output:")
        print("Summary KPIs:", res.get("summary_kpis"))
        print("Shopee Top Products:", len(res.get("shopee_analytics", {}).get("top_shopee_products", [])))
        print("LIA Topics:", len(res.get("lia_analytics", {}).get("topics_breakdown", [])))
        print("Test passed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    test_bi_endpoint()
