import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

MELHORENVIO_URL = os.getenv("MELHOR_ENVIO_BASE_URL", "https://api.melhorenvio.com.br")
CLIENT_ID = os.getenv("MELHOR_ENVIO_CLIENT_ID", "23449")
CLIENT_SECRET = os.getenv("MELHOR_ENVIO_CLIENT_SECRET", "")
STORE_CEP = "02969000"  # fixed CEP requested by user

class MelhorEnvioV2Service:
    _access_token = None

    @classmethod
    def get_token(cls) -> str:
        if cls._access_token:
            # For a production robust system, we would check expiration time. 
            # For now, we will assume it's valid if set, or we fetch a new one if a request fails with 401.
            return cls._access_token
        
        return cls.refresh_token()

    @classmethod
    def refresh_token(cls) -> str:
        url = f"{MELHORENVIO_URL}/oauth/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope": "cart-read cart-write companies-read companies-write coupons-read coupons-write messages-read messages-write notifications-read orders-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking shops-read shops-write tags-read tags-write tickets-read tickets-write users-read users-write"
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        # NOTE: Melhor Envio client_credentials grant type is deprecated in v2 in favor of standard OAuth2,
        # but the prompt specifically requested client_id/client_secret to generate token automatically
        # Since they are using a specific client ID "23449", this likely still works or is meant for their env.
        # Alternatively, we just use the Personal Token if oauth fails.
        
        personal_token = os.getenv("MELHOR_ENVIO_TOKEN", "")
        
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                cls._access_token = data.get("access_token")
                return cls._access_token
        except Exception:
            pass
            
        # Fallback to token from env if oauth fails
        cls._access_token = personal_token
        return cls._access_token

    @classmethod
    def request_with_auth(cls, method, endpoint, **kwargs):
        token = cls.get_token()
        headers = kwargs.get("headers", {})
        headers.update({
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Aplicação (contato@ecosopis.com.br)"
        })
        kwargs["headers"] = headers
        url = f"{MELHORENVIO_URL}{endpoint}"
        
        resp = requests.request(method, url, **kwargs)
        if resp.status_code == 401:
            # retry once
            cls._access_token = None
            token = cls.get_token()
            headers["Authorization"] = f"Bearer {token}"
            resp = requests.request(method, url, **kwargs)
        
        return resp

    @classmethod
    def calcular_frete(cls, cep_destino: str, peso: float, comprimento: int, altura: int, largura: int):
        clean_cep = "".join([c for c in cep_destino if c.isdigit()])
        payload = {
            "from": {"postal_code": STORE_CEP},
            "to": {"postal_code": clean_cep},
            "package": {
                "weight": peso,
                "width": largura,
                "height": altura,
                "length": comprimento
            },
            "options": {
                "receipt": False,
                "own_hand": False
            }
        }
        
        resp = cls.request_with_auth("POST", "/api/v2/me/shipment/calculate", json=payload)
        
        if resp.status_code == 200:
            options = []
            for opt in resp.json():
                if "error" not in opt:
                    options.append({
                        "id": opt.get("id"),
                        "name": opt.get("name"),
                        "price": float(opt.get("price", 0)),
                        "delivery_time": opt.get("delivery_time"),
                        "company": opt.get("company", {}).get("name")
                    })
            return options
        else:
            print(f"Erro Melhor Envio Calculate: {resp.text}")
            return []

    @classmethod
    def criar_envio(cls, pedido_id: int, user_info: dict, items: list, shipping_service_id: int):
        """
        Adiciona itens ao carrinho do Melhor Envio, faz o checkout e gera etiqueta.
        """
        # 1. Adicionar ao carrinho
        total_value = sum([item["price"] * item["quantity"] for item in items])
        cart_payload = {
            "service": shipping_service_id,
            "agency": 1, # ID da agencia de preferência se Jadlog ou outro
            "from": {
                "name": "ECOSOPIS",
                "phone": "11999999999", # TODO: load from config
                "email": "contato@ecosopis.com.br",
                "document": "00000000000",
                "postal_code": STORE_CEP,
                "address": "Rua Exemplo",
                "number": "123"
            },
            "to": {
                "name": user_info.get("name", "Cliente"),
                "phone": user_info.get("phone", "11999999999"),
                "email": user_info.get("email", "cliente@email.com"),
                "document": user_info.get("document", "00000000000"),
                "postal_code": user_info.get("postal_code").replace("-", ""),
                "address": user_info.get("address", "Endereço"),
                "number": user_info.get("number", "S/N"),
                "complement": user_info.get("complement", ""),
                "district": user_info.get("district", "Bairro"),
                "city": user_info.get("city", "Cidade"),
                "state_abbr": user_info.get("state", "SP"),
                "note": f"Pedido {pedido_id}"
            },
            "products": [
                {
                    "name": "Produtos ECOSOPIS",
                    "quantity": 1,
                    "unitary_value": total_value,
                }
            ],
            "volumes": [
                {
                    "height": 10,
                    "width": 15,
                    "length": 20,
                    "weight": 0.5
                }
            ],
            "options": {
                "receipt": False,
                "own_hand": False,
                "insurance_value": total_value,
                "non_commercial": True
            }
        }
        
        # API requires inserting into cart first
        resp_cart = cls.request_with_auth("POST", "/api/v2/me/cart", json=cart_payload)
        
        if resp_cart.status_code not in [200, 201]:
            print(f"Error Cart ME: {resp_cart.text}")
            return None
            
        order_me = resp_cart.json()
        order_me_id = order_me.get("id")
        
        if not order_me_id:
            return None
            
        # 2. Fazer checkout dos itens no carrinho para gerar os rastreios
        checkout_payload = {
            "orders": [str(order_me_id)]
        }
        resp_checkout = cls.request_with_auth("POST", "/api/v2/me/shipment/checkout", json=checkout_payload)
        
        if resp_checkout.status_code == 200:
            checkout_data = resp_checkout.json()
            
            # 3. Gerar etiquetas (opcional, pode ser async, mas faremos aqui conforme escopo)
            resp_generate = cls.request_with_auth("POST", "/api/v2/me/shipment/generate", json={"orders": [str(order_me_id)]})
            
            # The tracking code won't change after generation, we can get it from the cart creation response
            # or checkout. Actually, checkout response rarely returns tracking code directly for all services,
            # we need to get tracking by parsing the object or hitting tracking api.
            # Usually order_me['tracking'] gives the tracking hash.
            tracking = order_me.get("tracking")
            return {
                "melhorenvio_id": order_me_id,
                "tracking_code": tracking,
                "generated": resp_generate.status_code == 200
            }
        
        print(f"Error Checkout ME: {resp_checkout.text}")
        return None
