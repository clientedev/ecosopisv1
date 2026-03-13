import os
import mercadopago
from dotenv import load_dotenv

load_dotenv()

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000")

sdk = mercadopago.SDK(MP_ACCESS_TOKEN)


def create_pix_payment(order_id: int, total: float, customer_email: str,
                        customer_name: str, items: list) -> dict:
    """
    Creates a PIX payment via Mercado Pago API.
    Returns dict with qr_code, qr_code_base64, payment_id.
    """
    payment_data = {
        "transaction_amount": round(float(total), 2),
        "description": f"Pedido ECOSOPIS #{order_id}",
        "payment_method_id": "pix",
        "payer": {
            "email": customer_email,
            "first_name": customer_name.split()[0] if customer_name else "Cliente",
            "last_name": " ".join(customer_name.split()[1:]) if len(customer_name.split()) > 1 else "ECOSOPIS",
        },
        "external_reference": str(order_id),
        "notification_url": f"{FRONTEND_URL.replace('5000', '8000')}/orders/webhook",
    }

    result = sdk.payment().create(payment_data)
    response = result.get("response", {})

    if result.get("status") not in [200, 201]:
        raise Exception(f"Erro MP PIX: {response}")

    point_of_interaction = response.get("point_of_interaction", {})
    transaction_data = point_of_interaction.get("transaction_data", {})

    return {
        "payment_id": str(response.get("id", "")),
        "qr_code": transaction_data.get("qr_code", ""),
        "qr_code_base64": transaction_data.get("qr_code_base64", ""),
        "status": response.get("status", "pending"),
    }


def create_checkout_pro_preference(order_id: int, total: float, customer_email: str,
                                    customer_name: str, items: list) -> dict:
    """
    Creates a Checkout Pro preference for ALL payment methods (official way).
    Returns dict with preference_id and init_point (redirect URL).
    """
    mp_items = []
    for item in items:
        # Standardizing item structure for MP
        mp_items.append({
            "id": str(item.get("product_id", "")),
            "title": item.get("product_name", "Produto ECOSOPIS"),
            "description": item.get("description", "Cosmético Natural"),
            "category_id": "health",
            "quantity": int(item.get("quantity", 1)),
            "unit_price": float(round(float(item.get("price", 0)), 2)),
            "currency_id": "BRL",
        })

    # Prepare payer data
    first_name = "Cliente"
    last_name = "ECOSOPIS"
    if customer_name:
        parts = customer_name.split()
        first_name = parts[0]
        if len(parts) > 1:
            last_name = " ".join(parts[1:])

    preference_data = {
        "items": mp_items,
        "payer": {
            "name": first_name,
            "surname": last_name,
            "email": customer_email,
        },
        "back_urls": {
            "success": f"{FRONTEND_URL}/pedido/{order_id}?status=success",
            "failure": f"{FRONTEND_URL}/pedido/{order_id}?status=failure",
            "pending": f"{FRONTEND_URL}/pedido/{order_id}?status=pending",
        },
        "auto_return": "approved",
        "external_reference": str(order_id),
        # notification_url should point to the BACKEND reachable by MP
        # In development this might fail if not using ngrok/tunnel
        "notification_url": f"{FRONTEND_URL.replace('5000', '8000')}/orders/webhook",
        "statement_descriptor": "ECOSOPIS",
        "payment_methods": {
            "excluded_payment_types": [],
            "installments": 12
        }
    }

    result = sdk.preference().create(preference_data)
    response = result.get("response", {})

    if result.get("status") not in [200, 201]:
        raise Exception(f"Erro MP Preference: {response}")

    return {
        "preference_id": response.get("id", ""),
        "init_point": response.get("init_point", ""),
        "sandbox_init_point": response.get("sandbox_init_point", ""),
    }


def get_payment_status(payment_id: str) -> dict:
    """Query payment status from Mercado Pago."""
    result = sdk.payment().get(payment_id)
    response = result.get("response", {})
    return {
        "id": str(response.get("id", "")),
        "status": response.get("status", "unknown"),
        "status_detail": response.get("status_detail", ""),
        "external_reference": response.get("external_reference", ""),
    }


# Map MP statuses to our internal statuses
MP_STATUS_MAP = {
    "approved": "paid",
    "authorized": "paid",
    "in_process": "pending",
    "pending": "pending",
    "rejected": "cancelled",
    "cancelled": "cancelled",
    "refunded": "cancelled",
    "charged_back": "cancelled",
}
