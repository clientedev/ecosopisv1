import os
import stripe
from dotenv import load_dotenv

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

class StripeService:
    @classmethod
    def criar_checkout_session(cls, pedido_id: int, items: list, total_value: float, shipping_price: float, return_url: str = None) -> dict:
        total_cents = int(round(total_value * 100))
        shipping_cents = int(round(shipping_price * 100))
        
        base_url = (return_url or FRONTEND_URL).rstrip("/")
        
        line_items = []
        for item in items:
            line_items.append({
                "price_data": {
                    "currency": "brl",
                    "product_data": {"name": item.get("product_name", "Produto ECOSOPIS")},
                    "unit_amount": int(round(float(item.get("price", 0)) * 100)),
                },
                "quantity": int(item.get("quantity", 1)),
            })
        
        if shipping_cents > 0:
            line_items.append({
                "price_data": {
                    "currency": "brl",
                    "product_data": {"name": "Frete"},
                    "unit_amount": shipping_cents,
                },
                "quantity": 1,
            })

        session = stripe.checkout.Session.create(
            automatic_payment_methods={"enabled": True},
            mode="payment",
            line_items=line_items,
            success_url=f"{base_url}/pagamento?status=approved&order_id={pedido_id}",
            cancel_url=f"{base_url}/pagamento?status=failure&order_id={pedido_id}",
            metadata={
                "pedido_id": str(pedido_id),
            },
        )

        return {
            "session_id": session.id,
            "checkout_url": session.url
        }

    @classmethod
    def validar_webhook(cls, payload: bytes, sig_header: str) -> stripe.Event:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
            return event
        except ValueError as e:
            raise ValueError("Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            raise ValueError("Invalid signature")

    @classmethod
    def get_checkout_session(cls, session_id: str):
        try:
            return stripe.checkout.Session.retrieve(session_id)
        except Exception as e:
            err_str = str(e)
            if "No such checkout.session" not in err_str:
                print(f"Erro ao recuperar sessão Stripe: {e}")
            return None
