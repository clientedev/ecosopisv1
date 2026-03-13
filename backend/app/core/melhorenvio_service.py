import requests
import os
from dotenv import load_dotenv

load_dotenv()

MELHORENVIO_URL = os.getenv("MELHORENVIO_URL", "https://api.melhorenvio.com.br").strip()
MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN", "").strip()
MELHORENVIO_CLIENT_ID = os.getenv("MELHORENVIO_CLIENT_ID", "").strip()
MELHORENVIO_CLIENT_SECRET = os.getenv("MELHORENVIO_CLIENT_SECRET", "").strip()
STORE_CEP = os.getenv("STORE_CEP", "01001000").strip()

class MelhorEnvioService:
    MELHORENVIO_URL = MELHORENVIO_URL
    MELHORENVIO_TOKEN = MELHORENVIO_TOKEN # For fallback
    _cached_token = None

    @classmethod
    def _get_access_token(cls):
        """
        Obtém o token de acesso via OAuth ou retorna o token manual se configurado.
        """
        if cls._cached_token:
            return cls._cached_token

        # Se tiver Client ID/Secret, tenta gerar via OAuth
        if MELHORENVIO_CLIENT_ID and MELHORENVIO_CLIENT_SECRET:
            try:
                url = f"{MELHORENVIO_URL}/oauth/token"
                payload = {
                    "grant_type": "client_credentials",
                    "client_id": MELHORENVIO_CLIENT_ID,
                    "client_secret": MELHORENVIO_CLIENT_SECRET
                }
                headers = {"Accept": "application/json", "Content-Type": "application/json"}
                resp = requests.post(url, json=payload, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    cls._cached_token = data.get("access_token")
                    return cls._cached_token
                else:
                    print(f"Erro ao gerar token OAuth: {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"Falha na requisição de token: {e}")

        # Fallback para o token manual do .env
        return MELHORENVIO_TOKEN

    @classmethod
    def calculate_shipping(cls, dest_cep, items):
        """
        Calcula frete para múltiplas transportadoras via Melhor Envio.
        items: lista de objetos com {weight, width, height, length, price, quantity}
        """
        token = cls._get_access_token()
        if not token or token == "SEU_TOKEN_AQUI":
            print("Token do Melhor Envio não disponível")
            return []

        url = f"{MELHORENVIO_URL}/api/v2/me/shipment/calculate"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }

        # Lógica de Embalagem Automática
        total_quantity = sum(item.get("quantity", 1) for item in items)
        total_price = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
        
        # Peso médio por produto: 0.25kg
        total_weight = total_quantity * 0.25
        
        # Seleção de Caixa
        if total_quantity <= 2:
            # Caixa P
            width, height, length = 16, 12, 20
        elif total_quantity <= 5:
            # Caixa M
            width, height, length = 20, 20, 20
        else:
            # Caixa G (6 ou mais)
            width, height, length = 30, 25, 25

        # Monta a requisição interna (o cliente não vê esses dados)
        products = [{
            "id": "envio_ecosopis",
            "width": width,
            "height": height,
            "length": length,
            "weight": total_weight,
            "insurance_value": total_price,
            "quantity": 1
        }]

        payload = {
            "from": {"postal_code": STORE_CEP},
            "to": {"postal_code": dest_cep},
            "products": products
        }

        try:
            print(f"Enviando consulta de frete para {dest_cep}")
            print(f"Payload: {payload}")
            response = requests.post(url, json=payload, headers=headers)
            print(f"Resposta Melhor Envio ({response.status_code}): {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                # Filtrar apenas as opções que não têm erro
                options = []
                for opt in data:
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
                print(f"Erro Melhor Envio: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Erro ao calcular frete: {e}")
            return []
