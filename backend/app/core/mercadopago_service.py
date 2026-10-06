import os
import mercadopago
from dotenv import load_dotenv

load_dotenv()

PROD_MP_ACCESS_TOKEN = "APP_USR-4537358767232135-032413-ba08bddc033a371e523702d69104d623-3281059589"
env_token = os.getenv("MP_ACCESS_TOKEN", "").strip()
if not env_token or "TEST-" in env_token or "TEST" in env_token.upper() or len(env_token) < 20:
    MP_ACCESS_TOKEN = PROD_MP_ACCESS_TOKEN
else:
    MP_ACCESS_TOKEN = env_token

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000")
BACKEND_URL = os.getenv("BACKEND_URL", "https://web-production-33f04.up.railway.app")

sdk = mercadopago.SDK(MP_ACCESS_TOKEN)


def is_valid_cpf(cpf: str) -> bool:
    """Valida número de CPF usando o algoritmo oficial dos dígitos verificadores (Módulo 11)."""
    digits = "".join(filter(str.isdigit, cpf or ""))
    if len(digits) != 11:
        return False
    if digits == digits[0] * 11:
        return False
    s1 = sum(int(digits[i]) * (10 - i) for i in range(9))
    d1 = (s1 * 10 % 11) % 10
    if d1 != int(digits[9]):
        return False
    s2 = sum(int(digits[i]) * (11 - i) for i in range(10))
    d2 = (s2 * 10 % 11) % 10
    return d2 == int(digits[10])


def _get_backend_base() -> str:
    """Return backend base URL for notification/webhook URLs.
    Prefers explicit BACKEND_URL env var. Falls back to FRONTEND_URL port
    replacement only for localhost (dev) environments."""
    if BACKEND_URL:
        return BACKEND_URL.rstrip("/")
    # Dev fallback: assume backend runs on port 8000
    if "localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL:
        return FRONTEND_URL.replace("3000", "8000").replace("5000", "8000").rstrip("/")
    # In production without BACKEND_URL set, use FRONTEND_URL as-is
    # (Nginx/reverse-proxy routes /api/* to the backend)
    return FRONTEND_URL.rstrip("/")


def create_pix_payment(order_id: int, total: float, customer_email: str,
                        customer_name: str, items: list = None, customer_cpf: str = "") -> dict:
    """
    Creates a PIX payment via Mercado Pago API.
    """
    # Prefer standardized backend notification path
    webhook_url = os.getenv("MP_WEBHOOK_URL") or f"{_get_backend_base()}/api/payment/webhook/mercadopago"
    
    clean_cpf = "".join(filter(str.isdigit, customer_cpf or ""))
    name_parts = (customer_name or "Cliente").split()
    first_name = name_parts[0] if name_parts else "Cliente"
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "ECOSOPIS"

    payer_data = {
        "email": customer_email,
        "first_name": first_name,
        "last_name": last_name,
    }
    # Mercado Pago rejeita com HTTP 400 (código 2067) se o CPF for inválido no algoritmo Módulo 11.
    # Se o CPF for válido, incluímos na identificação do pagador.
    # Se for ausente ou inválido, omitimos identification (o Mercado Pago gera o PIX com sucesso 201).
    if clean_cpf and is_valid_cpf(clean_cpf):
        payer_data["identification"] = {
            "type": "CPF",
            "number": clean_cpf
        }

    payment_data = {
        "transaction_amount": round(float(total), 2),
        "description": f"Pedido ECOSOPIS #{order_id}",
        "payment_method_id": "pix",
        "payer": payer_data,
        "external_reference": str(order_id),
        "notification_url": webhook_url,
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
        "ticket_url": transaction_data.get("ticket_url", ""),
        "status": response.get("status", "pending"),
        "status_detail": response.get("status_detail", ""),
    }


def create_card_payment(
    order_id: int,
    total: float,
    token: str,
    installments: int,
    payment_method_id: str,
    customer_email: str,
    customer_name: str,
    customer_cpf: str,
    issuer_id: str = None,
    device_id: str = None,
) -> dict:
    """
    Processes a credit/debit card payment using a tokenized card via Mercado Pago API.
    Does NOT accept or log sensitive card numbers or CVV.
    Supports Device ID for anti-fraud analysis.
    """
    webhook_url = os.getenv("MP_WEBHOOK_URL") or f"{_get_backend_base()}/api/payment/webhook/mercadopago"
    
    clean_cpf = "".join(filter(str.isdigit, customer_cpf or ""))
    name_parts = (customer_name or "Cliente").split()
    first_name = name_parts[0] if name_parts else "Cliente"
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "ECOSOPIS"

    payer_data = {
        "email": customer_email,
        "first_name": first_name,
        "last_name": last_name,
    }
    if clean_cpf and is_valid_cpf(clean_cpf):
        payer_data["identification"] = {
            "type": "CPF",
            "number": clean_cpf
        }

    clean_total = round(float(total), 2)
    # Mercado Pago exige valor minimo de R$ 0,50 para processamento de cartao no Brasil
    charge_amount = max(0.50, clean_total)

    payment_data = {
        "transaction_amount": charge_amount,
        "token": token,
        "description": f"Pedido ECOSOPIS #{order_id}",
        "installments": int(installments) if installments and int(installments) > 0 else 1,
        "payment_method_id": payment_method_id,
        "payer": payer_data,
        "external_reference": str(order_id),
        "notification_url": webhook_url,
        "statement_descriptor": "ECOSOPIS"
    }

    if issuer_id:
        payment_data["issuer_id"] = str(issuer_id)

    req_options = None
    if device_id:
        try:
            from mercadopago.config import RequestOptions
            req_options = RequestOptions(custom_headers={"X-meli-session-id": str(device_id)})
        except Exception:
            pass

    if req_options:
        result = sdk.payment().create(payment_data, request_options=req_options)
    else:
        result = sdk.payment().create(payment_data)

    response = result.get("response", {})
    status_code = result.get("status")

    if status_code not in [200, 201]:
        error_msg = response.get("message") or response.get("cause") or str(response)
        raise Exception(f"Erro Mercado Pago Cartão: {error_msg}")

    return {
        "payment_id": str(response.get("id", "")),
        "status": response.get("status", "pending"),
        "status_detail": response.get("status_detail", ""),
        "payer": response.get("payer", {}),
    }


def create_checkout_pro_preference(order_id: int, items: list, shipping_price: float = 0.0, 
                                    customer_email: str = "", customer_name: str = "",
                                    customer_cpf: str = "", discount_amount: float = 0.0) -> dict:
    """
    Creates a Checkout Pro preference including products and shipping.
    """
    webhook_url = os.getenv("MP_WEBHOOK_URL") or f"{_get_backend_base()}/api/payment/webhook/mercadopago"
    
    total_items_price = sum(float(item.get("price", 0)) * int(item.get("quantity", 1)) for item in items)
    
    mp_items = []
    for item in items:
        # Prepare image URL if available
        image_url = item.get("image_url")
        if image_url and not image_url.startswith("http"):
            # Try to build absolute URL for the image
            backend_base = os.getenv("BACKEND_URL", FRONTEND_URL.replace("3000", "8000")).rstrip("/")
            # Assuming product images are in /static/uploads
            image_url = f"{backend_base}/static/uploads/{image_url.split('/')[-1]}"

        original_unit_price = float(item.get("price", 0))
        quantity = int(item.get("quantity", 1))
        
        # Apply proportional discount
        discounted_unit_price = original_unit_price
        if discount_amount > 0 and total_items_price > 0:
            ratio = max(0.0, 1 - (discount_amount / total_items_price))
            discounted_unit_price = max(0.01, original_unit_price * ratio)

        mp_items.append({
            "id": str(item.get("product_id", "")),
            "title": item.get("product_name", "Produto ECOSOPIS"),
            "quantity": quantity,
            "unit_price": float(round(discounted_unit_price, 2)),
            "currency_id": "BRL",
            "picture_url": image_url
        })

    # Add shipping as a separate item if > 0
    if shipping_price and shipping_price > 0:
        mp_items.append({
            "id": "shipping",
            "title": "Frete (Logística ECOSOPIS)",
            "quantity": 1,
            "unit_price": float(round(float(shipping_price), 2)),
            "currency_id": "BRL",
        })

    # Split name for MP payer structure
    name_parts = (customer_name or "Cliente").split()
    first_name = name_parts[0]
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "ECOSOPIS"

    payer_data = {
        "first_name": first_name,
        "last_name": last_name,
        "email": customer_email,
    }

    # Add CPF if available to help enable PIX
    if customer_cpf:
        # Sanitize CPF (keep only numbers)
        clean_cpf = "".join(filter(str.isdigit, customer_cpf))
        if clean_cpf and len(clean_cpf) >= 11:
            payer_data["identification"] = {
                "type": "CPF",
                "number": clean_cpf
            }

    frontend_base = FRONTEND_URL.rstrip("/") if FRONTEND_URL else "https://ecosopis.com.br"
    if not frontend_base.startswith("https://"):
        frontend_base = "https://ecosopis.com.br"

    preference_data = {
        "items": mp_items,
        "payer": payer_data,
        "back_urls": {
            "success": f"{frontend_base}/pagamento?status=approved&order_id={order_id}",
            "failure": f"{frontend_base}/pagamento?status=failure&order_id={order_id}",
            "pending": f"{frontend_base}/pagamento?status=pending&order_id={order_id}",
        },
        "auto_return": "approved",
        "external_reference": str(order_id),
        "notification_url": webhook_url,
        "statement_descriptor": "ECOSOPIS",
        "payment_methods": {
            "excluded_payment_methods": [],
            "excluded_payment_types": [],
            "installments": 12
        }
    }

    result = sdk.preference().create(preference_data)
    response = result.get("response", {})

    if result.get("status") not in [200, 201]:
        raise Exception(f"Erro MP Preference: {response}")

    return {
        "id": response.get("id", ""),
        "init_point": response.get("init_point", ""),
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
        "payer": response.get("payer", {}),
        "merchant_order_id": str(response.get("order", {}).get("id", "")),
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
