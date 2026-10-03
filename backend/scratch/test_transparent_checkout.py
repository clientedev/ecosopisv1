import os
import sys

# Ensure backend root is on path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.api.endpoints.payment import _translate_mp_status_detail, _validate_and_calculate_order, CreateCheckoutIn, CheckoutItemIn
from app.core.database import SessionLocal
from app.models import models
from app.core.mercadopago_service import create_pix_payment, create_card_payment, create_checkout_pro_preference

client = TestClient(app)

def test_routes_exist():
    # 1. Config endpoint
    res = client.get("/api/payment/config")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert "transparent_checkout_enabled" in data
    assert "mp_public_key" in data
    print("[OK] GET /api/payment/config verified:", data)

    # 2. Existing Checkout Pro route exists (without token returns 401)
    res_pro = client.post("/api/payment/create-mercadopago-checkout", json={})
    assert res_pro.status_code in [401, 422], f"Expected 401/422, got {res_pro.status_code}"
    print("[OK] POST /api/payment/create-mercadopago-checkout (Checkout Pro) verified preserved")

    # 3. Transparent PIX route exists (without token returns 401)
    res_pix = client.post("/api/payment/process-transparent-pix", json={})
    assert res_pix.status_code in [401, 422], f"Expected 401/422, got {res_pix.status_code}"
    print("[OK] POST /api/payment/process-transparent-pix verified")

    # 4. Transparent Card route exists (without token returns 401)
    res_card = client.post("/api/payment/process-transparent-card", json={})
    assert res_card.status_code in [401, 422], f"Expected 401/422, got {res_card.status_code}"
    print("[OK] POST /api/payment/process-transparent-card verified")

    # 5. Webhook health check
    res_wh = client.get("/api/payment/webhook/mercadopago")
    assert res_wh.status_code == 200, f"Expected 200, got {res_wh.status_code}"
    print("[OK] GET /api/payment/webhook/mercadopago verified preserved")


def test_status_detail_translations():
    assert "insuficiente" in _translate_mp_status_detail("cc_rejected_insufficient_amount")
    assert "segurança" in _translate_mp_status_detail("cc_rejected_bad_filled_security_code")
    assert "antifraude" in _translate_mp_status_detail("cc_rejected_high_risk")
    print("[OK] Status detail translation dictionary verified")


def test_validation_logic():
    db = SessionLocal()
    try:
        # Get a real active product from db
        prod = db.query(models.Product).filter(models.Product.is_active == True).first()
        if not prod:
            print("Notice: No products in DB to test validation details, skipping product check.")
            return

        user = db.query(models.User).first()
        if not user:
            print("Notice: No users in DB, skipping user check.")
            return

        order_data = CreateCheckoutIn(
            items=[CheckoutItemIn(
                product_id=prod.id,
                product_name=prod.name,
                quantity=1,
                price=9999.0 # Attempted manipulation - should be overwritten by real server price
            )],
            total=1.0, # Attempted manipulation - should be overwritten by backend calculation
            shipping_price=20.0,
            customer_cpf="123.456.789-01",
            address={"postal_code": "01001-000", "state": "SP"}
        )

        res = _validate_and_calculate_order(order_data, user, db)
        assert order_data.customer_cpf == "12345678901", "CPF should be sanitized to 11 digits"
        assert order_data.items[0].price == prod.price or order_data.items[0].price == prod.sale_price, "Price must be server-validated"
        assert order_data.total > 1.0, "Total must be calculated strictly by backend"
        print(f"[OK] Server validation prevented tampering: calculated total = R$ {res['final_total']}")

    finally:
        db.close()


if __name__ == "__main__":
    test_routes_exist()
    test_status_detail_translations()
    test_validation_logic()
    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")
