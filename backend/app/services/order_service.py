from typing import List
from app.repositories.order_repository import OrderRepository
from app.services.stripe_service import StripeService
from app.services.melhorenvio_service import MelhorEnvioV2Service

class OrderService:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    def create_checkout(self, user_id: int, items: List[dict], shipping_price: float, shipping_method_id: str, address_info: dict, return_url: str = None, coupon_code: str = None, discount_amount: float = 0.0):
        """
        1. Calcula o total
        2. Cria o pedido "pending"
        3. Cria os itens do pedido
        4. Cria Stripe Checkout Session
        5. Atualiza Pedido com Session ID
        """
        product_total = sum([item["price"] * item["quantity"] for item in items])
        final_product_total = max(0.0, product_total - discount_amount)
        order_total = final_product_total + shipping_price
        
        # 1. & 2. Create Order
        order = self.repo.create_order(
            user_id=user_id,
            total=order_total,
            shipping_price=shipping_price,
            shipping_method=shipping_method_id,
            address=address_info,
            status="pending",
            coupon_code=coupon_code,
            discount_amount=discount_amount
        )
        
        # Save custom properties like address
        # Currently, the address structure could be saved in models if implemented.
        # Assuming we just proceed directly for the scope.
        
        # 3. Create items
        self.repo.add_order_items(order.id, items)
        
        # 4. Stripe Checkout Session
        stripe_res = StripeService.criar_checkout_session(
            pedido_id=order.id,
            total_value=final_product_total,
            shipping_price=shipping_price,
            return_url=return_url
        )
        
        # 5. Save session
        self.repo.save_stripe_session(order.id, stripe_res["session_id"])
        
        return {
            "pedido_id": order.id,
            "checkout_url": stripe_res["checkout_url"]
        }

    def handle_payment_success(self, pedido_id: int):
        """
        1. Marcar como pago
        2. Chamar ME criar envio
        3. Atualizar codigo rastreio
        """
        order = self.repo.update_order_status(pedido_id, "paid")
        if not order:
            return None
            
        print(f"Pedido {pedido_id} marcado como pago.")
        
        # Build user address info for shipping from order JSON address
        address_info = order.address or {}
        user_info = {
            "name": order.customer_name or address_info.get("name") or "Cliente",
            "phone": order.customer_phone or address_info.get("phone") or "11999999999",
            "email": order.customer_email or address_info.get("email") or "cliente@email.com",
            "postal_code": address_info.get("postal_code", "01000000"),
            "document": address_info.get("document", "00000000000"),
            "address": address_info.get("street", "Rua"),
            "number": address_info.get("number", "S/N"),
            "complement": address_info.get("complement", ""),
            "district": address_info.get("neighborhood", "Bairro"),
            "city": address_info.get("city", "Cidade"),
            "state": address_info.get("state", "SP")
        }
        
        items_payload = []
        for oi in order.order_items:
            items_payload.append({
                "price": oi.price,
                "quantity": oi.quantity
            })
            
        try:
            me_res = MelhorEnvioV2Service.criar_envio(
                pedido_id=order.id,
                user_info=user_info,
                items=items_payload,
                shipping_service_id=int(order.shipping_method) if order.shipping_method and order.shipping_method.isdigit() else 1
            )
            
            if me_res and me_res.get("tracking_code"):
                self.repo.save_tracking_code(order.id, me_res["tracking_code"])
                print(f"Pedido {pedido_id} etiquetado ME com tracking {me_res['tracking_code']}")
        except Exception as e:
            print(f"Erro ao criar envio ME: {e}")
            
        return order

    def sync_order_status(self, order_id: int):
        """
        Sincroniza proativamente o status do pedido com a Stripe.
        Útil para quando o webhook atrasa ou falha.
        """
        order = self.repo.get_order_by_id(order_id)
        if not order or order.status != "pending" or not order.stripe_session_id:
            return order

        session = StripeService.get_checkout_session(order.stripe_session_id)
        if session and session.payment_status == "paid":
            print(f"Sincronização: Pedido {order_id} detectado como pago na Stripe.")
            return self.handle_payment_success(order_id)
        
        return order
