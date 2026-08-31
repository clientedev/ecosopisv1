from typing import List
from app.repositories.order_repository import OrderRepository
from app.services.stripe_service import StripeService

class OrderService:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    def create_checkout(self, user_id: int, items: List[dict], shipping_price: float, shipping_method_id: str, address_info: dict, return_url: str = None, coupon_code: str = None, discount_amount: float = 0.0, customer_cpf: str = None):
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
        # Extract customer_cpf from address_info if not passed directly
        resolved_cpf = customer_cpf or address_info.get("customer_cpf") or None

        order = self.repo.create_order(
            user_id=user_id,
            total=order_total,
            items=items,
            shipping_price=shipping_price,
            shipping_method=shipping_method_id,
            address=address_info,
            status="pending",
            coupon_code=coupon_code,
            discount_amount=discount_amount,
            customer_cpf=resolved_cpf
        )
        
        # Save custom properties like address
        # Currently, the address structure could be saved in models if implemented.
        # Assuming we just proceed directly for the scope.
        
        # 3. Create items
        self.repo.add_order_items(order.id, items)
        
        # 4. Stripe Checkout Session
        stripe_res = StripeService.criar_checkout_session(
            pedido_id=order.id,
            items=items,
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

    def handle_payment_success(
        self,
        pedido_id: int,
        payment_id: str = None,
        session_id: str = None,
        buyer_email: str = None,
        buyer_name: str = None,
    ):
        """
        Finaliza um pedido pago usando o mesmo fluxo dos webhooks atuais.

        Este método é mantido como ponto de compatibilidade para o webhook
        legado em /checkout/webhook/stripe. A regra de negócio real fica
        centralizada em finalize_order_on_payment, que também é usada pelo
        pagamento manual e pelos webhooks atuais.
        """
        order = self.repo.get_order_by_id(pedido_id)
        if not order:
            return None

        # Local import avoids the payment.py -> OrderService import cycle.
        from app.api.endpoints.payment import finalize_order_on_payment

        finalize_order_on_payment(
            order=order,
            db=self.repo.db,
            payment_id=payment_id,
            session_id=session_id,
            buyer_email=buyer_email,
            buyer_name=buyer_name,
        )
        return order

    def sync_order_status(self, order_id: int):
        """
        Sincroniza proativamente o status do pedido com a Stripe.
        Útil para quando o webhook atrasa ou falha.
        """
        order = self.repo.get_order_by_id(order_id)
        if not order or order.status != "pending" or not order.stripe_session_id:
            return order

        try:
            session = StripeService.get_checkout_session(order.stripe_session_id)
            if session and session.payment_status == "paid":
                print(f"Sincronização: Pedido {order_id} detectado como pago na Stripe.")
                customer_details = getattr(session, "customer_details", None) or {}
                return self.handle_payment_success(
                    order_id,
                    payment_id=getattr(session, "payment_intent", None),
                    session_id=getattr(session, "id", None),
                    buyer_email=customer_details.get("email"),
                    buyer_name=customer_details.get("name"),
                )
        except Exception as e:
            err_str = str(e)
            if "No such checkout.session" in err_str or "no such" in err_str.lower():
                pass
            else:
                print(f"Erro ao sincronizar pedido {order_id} com Stripe: {e}")
        
        return order

    def sync_mp_order_status(self, order_id: int):
        """
        Sincroniza proativamente o status do pedido com o Mercado Pago.
        Busca pagamentos relacionados ao external_reference (order_id) por múltiplos métodos.
        """
        order = self.repo.get_order_by_id(order_id)
        if not order or order.status in ("paid", "shipped", "delivered", "cancelled"):
            return order

        try:
            from app.core.mercadopago_service import sdk as mp_sdk, get_payment_status as get_mp_payment_status
            
            # 1. Se já possui mercadopago_payment_id associado, consulta diretamente
            mp_payment_id = getattr(order, "mercadopago_payment_id", None)
            if mp_payment_id:
                try:
                    p_info = get_mp_payment_status(str(mp_payment_id))
                    if p_info.get("status") in ["approved", "authorized"]:
                        from app.api.endpoints.payment import finalize_order_on_payment
                        finalize_order_on_payment(
                            order=order,
                            db=self.repo.db,
                            payment_id=str(mp_payment_id),
                            buyer_email=p_info.get("payer", {}).get("email")
                        )
                        return order
                except Exception as p_err:
                    print(f"Aviso na consulta direta MP payment {mp_payment_id}: {p_err}")

            # 2. Busca por payment().search
            filters = {"external_reference": str(order_id)}
            result = mp_sdk.payment().search(filters)
            if result.get("status") in [200, 201]:
                payments = result.get("response", {}).get("results", [])
                for payment in payments:
                    if payment.get("status") in ["approved", "authorized"]:
                        print(f"Sincronização: Pedido {order_id} detectado como pago no Mercado Pago via payment.search.")
                        from app.api.endpoints.payment import finalize_order_on_payment
                        finalize_order_on_payment(
                            order=order,
                            db=self.repo.db,
                            payment_id=str(payment.get("id")),
                            buyer_email=payment.get("payer", {}).get("email")
                        )
                        return order

            # 3. Busca por merchant_order().search
            mo_result = mp_sdk.merchant_order().search(filters)
            if mo_result.get("status") in [200, 201]:
                merchant_orders = mo_result.get("response", {}).get("elements", []) or mo_result.get("response", {}).get("results", [])
                for mo in merchant_orders:
                    payments = mo.get("payments", [])
                    for p in payments:
                        if p.get("status") in ["approved", "authorized"]:
                            print(f"Sincronização: Pedido {order_id} detectado como pago no Mercado Pago via merchant_order.")
                            from app.api.endpoints.payment import finalize_order_on_payment
                            finalize_order_on_payment(
                                order=order,
                                db=self.repo.db,
                                payment_id=str(p.get("id")),
                                buyer_email=mo.get("payer", {}).get("email")
                            )
                            return order
        except Exception as e:
            print(f"Erro ao sincronizar pedido {order_id} com Mercado Pago: {e}")
        
        return order
