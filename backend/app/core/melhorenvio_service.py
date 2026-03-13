import requests
import os
from dotenv import load_dotenv

load_dotenv()

MELHORENVIO_URL = os.getenv("MELHORENVIO_URL", "https://sandbox.melhorenvio.com.br")
MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN")
STORE_CEP = os.getenv("STORE_CEP", "01001000") # CEP padrão de exemplo

class MelhorEnvioService:
    @staticmethod
    def calculate_shipping(dest_cep, items):
        """
        Calcula frete para múltiplas transportadoras via Melhor Envio.
        items: lista de objetos com {weight, width, height, length, price, quantity}
        """
        if not MELHORENVIO_TOKEN:
            print("MELHORENVIO_TOKEN não configurado")
            return []

        url = f"{MELHORENVIO_URL}/api/v2/me/shipment/calculate"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MELHORENVIO_TOKEN}"
        }

        # Melhor Envio espera um array de produtos
        products = []
        for item in items:
            products.append({
                "id": str(item.get("id", "1")),
                "width": item.get("width", 15),
                "height": item.get("height", 15),
                "length": item.get("length", 15),
                "weight": item.get("weight", 0.5),
                "insurance_value": item.get("price", 10.0),
                "quantity": item.get("quantity", 1)
            })

        payload = {
            "from": {"postal_code": STORE_CEP},
            "to": {"postal_code": dest_cep},
            "products": products
        }

        try:
            response = requests.post(url, json=payload, headers=headers)
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
