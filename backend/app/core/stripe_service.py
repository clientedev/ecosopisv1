"""
Stripe payment service — replaces mercadopago_service.py
"""
import os
import stripe
from dotenv import load_dotenv

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def create_checkout_session(order_id: int, items: list, shipping_price: float = 20.0) -> dict:
    """
    Creates a Stripe Checkout Session.
    Returns dict with session_id and checkout_url.
    """
    line_items = []
    for item in items:
        line_items.append({
            "price_data": {
                "currency": "brl",
                "product_data": {
                    "name": item.get("product_name", "Produto ECOSOPIS"),
                },
                "unit_amount": int(round(float(item.get("price", 0)) * 100)),
            },
            "quantity": int(item.get("quantity", 1)),
        })

    # Add shipping as a line item
    if shipping_price and shipping_price > 0:
        line_items.append({
            "price_data": {
                "currency": "brl",
                "product_data": {
                    "name": "Frete",
                },
                "unit_amount": int(round(float(shipping_price) * 100)),
            },
            "quantity": 1,
        })

    frontend_url = FRONTEND_URL.rstrip("/")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        line_items=line_items,
        success_url=f"{frontend_url}/pagamento?status=approved&order_id={order_id}",
        cancel_url=f"{frontend_url}/pagamento?status=failure&order_id={order_id}",
        metadata={
            "pedido_id": str(order_id),
        },
    )

    return {
        "session_id": session.id,
        "checkout_url": session.url,
    }


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """
    Verifies a Stripe webhook signature and returns the event.
    Raises an exception if verification fails.
    """
    event = stripe.Webhook.construct_event(
        payload, sig_header, STRIPE_WEBHOOK_SECRET
    )
    return event
