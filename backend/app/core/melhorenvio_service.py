import requests
import os
import re
import json
from dotenv import load_dotenv

load_dotenv()

# Configurações do Melhor Envio (aceitando nomes com e sem underscore para evitar erro)
MELHORENVIO_URL = os.getenv("MELHORENVIO_URL", os.getenv("MELHOR_ENVIO_BASE_URL", "https://www.melhorenvio.com.br")).strip()
MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN", os.getenv("MELHOR_ENVIO_TOKEN", "")).strip()
MELHORENVIO_CLIENT_ID = os.getenv("MELHORENVIO_CLIENT_ID", os.getenv("MELHOR_ENVIO_CLIENT_ID", "")).strip()
MELHORENVIO_CLIENT_SECRET = os.getenv("MELHORENVIO_CLIENT_SECRET", os.getenv("MELHOR_ENVIO_CLIENT_SECRET", "")).strip()
# Impedir crash se houver `api.` na URL fornecida
if "api.melhorenvio.com.br" in MELHORENVIO_URL:
    MELHORENVIO_URL = MELHORENVIO_URL.replace("api.melhorenvio.com.br", "www.melhorenvio.com.br")
# CEP de Origem (Padrão: 07430350 conforme solicitado)
STORE_CEP = re.sub(r"\D", "", os.getenv("STORE_CEP", "07430350")).strip()

class MelhorEnvioService:
    MELHORENVIO_URL = MELHORENVIO_URL
    MELHORENVIO_TOKEN = MELHORENVIO_TOKEN
    _cached_token = None

    @classmethod
    def _get_access_token(cls):
        """
        Obtém o token de acesso via OAuth ou retorna o token manual se configurado.
        """
        if cls._cached_token:
            return cls._cached_token

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
                    print("Token OAuth gerado com sucesso")
                    return cls._cached_token
                else:
                    print(f"Erro ao gerar token OAuth: {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"Falha na requisição de token: {e}")

        return MELHORENVIO_TOKEN

    @classmethod
    def calculate_shipping(cls, dest_cep, items):
        """
        Calcula frete para múltiplas transportadoras via Melhor Envio com validações rigorosas.
        """
        token = cls._get_access_token()
        if not token or token == "SEU_TOKEN_AQUI":
            print("Token do Melhor Envio não disponível")
            return []

        # Limpeza do CEP de destino
        clean_dest_cep = re.sub(r"\D", "", str(dest_cep))
        
        url = f"{MELHORENVIO_URL}/api/v2/me/shipment/calculate"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }

        # Lógica de Embalagem Automática
        total_quantity = sum(item.get("quantity", 1) for item in items)
        total_price = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
        
        # Peso total (mínimo 0.1kg per item logic simplified to total)
        total_weight = max(total_quantity * 0.25, 0.1)
        
        # Melhor Envio strict minimums from user feedback
        min_width, min_height, min_length, min_weight = 16, 12, 20, 0.3
        
        # Seleção de Caixa baseada na quantidade
        if total_quantity <= 2:
            width, height, length = 16, 12, 20
        elif total_quantity <= 5:
            width, height, length = 20, 20, 20
        else:
            width, height, length = 30, 25, 25

        # Garantir dimensões e peso mínimos recomendados
        width = max(width, min_width)
        height = max(height, min_height)
        length = max(length, min_length)
        total_weight = max(total_weight, min_weight)

        payload = {
            "from": {"postal_code": STORE_CEP},
            "to": {"postal_code": clean_dest_cep},
            "products": [{
                "id": "envio_ecosopis",
                "width": width,
                "height": height,
                "length": length,
                "weight": total_weight,
                "insurance_value": total_price,
                "quantity": 1
            }],
            "options": {
                "insurance_value": total_price,
                "receipt": False,
                "own_hand": False
            },
            "services": "" # Permitir todos os serviços ativos
        }

        try:
            print(f"--- MelhorEnvio Freight Request ---")
            print(f"URL: {url}")
            print(f"Payload enviado: {json.dumps(payload, indent=2)}")
            
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            
            print(f"Status Code: {response.status_code}")
            print(f"Resposta completa: {response.text}")

            if response.status_code == 200:
                data = response.json()
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
                print(f"MELHORENVIO_ERROR: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Erro na conexão com Melhor Envio: {e}")
            return []
