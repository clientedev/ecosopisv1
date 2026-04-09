import requests
import os
import re
import json
from dotenv import load_dotenv

load_dotenv(override=True)

# Configurações do Melhor Envio (aceitando nomes com e sem underscore para evitar erro)
MELHORENVIO_URL = os.getenv("MELHORENVIO_URL", os.getenv("MELHOR_ENVIO_BASE_URL", "https://api.melhorenvio.com.br")).strip()
MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN", os.getenv("MELHOR_ENVIO_TOKEN", "")).strip()
MELHORENVIO_CLIENT_ID = os.getenv("MELHORENVIO_CLIENT_ID", os.getenv("MELHOR_ENVIO_CLIENT_ID", "")).strip()
MELHORENVIO_CLIENT_SECRET = os.getenv("MELHORENVIO_CLIENT_SECRET", os.getenv("MELHOR_ENVIO_CLIENT_SECRET", "")).strip()
# Garante que sempre usamos o endpoint correto da API Melhor Envio
if "melhorenvio.com.br" in MELHORENVIO_URL and "api.melhorenvio.com.br" not in MELHORENVIO_URL:
    MELHORENVIO_URL = "https://api.melhorenvio.com.br"
# CEP de Origem da loja — prioriza MELHORENVIO_CEP_ORIGEM, depois STORE_CEP
STORE_CEP = re.sub(r"\D", "", os.getenv("MELHORENVIO_CEP_ORIGEM", os.getenv("STORE_CEP", "02969000"))).strip()

class MelhorEnvioService:
    MELHORENVIO_URL = MELHORENVIO_URL
    MELHORENVIO_TOKEN = MELHORENVIO_TOKEN
    STORE_CEP = STORE_CEP
    _cached_token = None

    @classmethod
    def _get_access_token(cls):
        """
        Obtém o token de acesso via OAuth ou retorna o token manual se configurado.
        """
        if cls._cached_token:
            return cls._cached_token

        # O token pessoal (Token do Painel) tem todas as permissões de usuário
        if MELHORENVIO_TOKEN:
            return MELHORENVIO_TOKEN

        if MELHORENVIO_CLIENT_ID and MELHORENVIO_CLIENT_SECRET:
            try:
                url = f"{MELHORENVIO_URL}/oauth/token"
                payload = {
                    "grant_type": "client_credentials",
                    "client_id": MELHORENVIO_CLIENT_ID,
                    "client_secret": MELHORENVIO_CLIENT_SECRET
                }
                headers = {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "ECOSOPIS/2.0 (ecosopisartesanais@gmail.com)",
                }
                resp = requests.post(url, json=payload, headers=headers, timeout=15)
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
        Retorna tupla (options, error_message).
        """
        token = cls._get_access_token()
        if not token or token == "SEU_TOKEN_AQUI":
            print("Token do Melhor Envio não disponível")
            return [], "Token do Melhor Envio não configurado."

        # Limpeza do CEP de destino
        clean_dest_cep = re.sub(r"\D", "", str(dest_cep))

        if len(clean_dest_cep) != 8:
            return [], f"CEP de destino inválido: {dest_cep}"

        url = f"{MELHORENVIO_URL}/api/v2/me/shipment/calculate"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "ECOSOPIS/2.0 (ecosopisartesanais@gmail.com)",
        }

        # Lógica de Embalagem Automática
        total_quantity = sum(item.get("quantity", 1) for item in items)
        total_price = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)

        # Peso total (mínimo 0.3kg)
        total_weight = max(total_quantity * 0.25, 0.3)

        # Melhor Envio strict minimums
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
        insurance_value = max(total_price, 1.0)

        payload = {
            "from": {"postal_code": STORE_CEP},
            "to": {"postal_code": clean_dest_cep},
            "products": [{
                "id": "envio_ecosopis",
                "width": width,
                "height": height,
                "length": length,
                "weight": total_weight,
                "insurance_value": insurance_value,
                "quantity": 1
            }],
            "options": {
                "insurance_value": insurance_value,
                "receipt": False,
                "own_hand": False
            },
            "services": ""  # Permitir todos os serviços ativos
        }

        last_error = None
        for attempt in range(1, 3):  # até 2 tentativas, mas para imediatamente se DNS falhar
            try:
                print(f"--- MelhorEnvio Freight Request (tentativa {attempt}) ---")
                print(f"URL: {url}")
                print(f"CEP origem: {STORE_CEP} | CEP destino: {clean_dest_cep}")
                print(f"Payload: {json.dumps(payload, indent=2)}")

                response = requests.post(url, json=payload, headers=headers, timeout=20)

                print(f"Status Code: {response.status_code}")
                print(f"Resposta: {response.text[:500]}")

                if response.status_code == 200:
                    data = response.json()
                    options = []
                    for opt in data:
                        if "error" not in opt and opt.get("price"):
                            options.append({
                                "id": opt.get("id"),
                                "name": opt.get("name"),
                                "price": float(opt.get("price", 0)),
                                "delivery_time": opt.get("delivery_time"),
                                "company": opt.get("company", {}).get("name")
                            })
                    if not options:
                        erros = [o.get("error", "") for o in data if "error" in o]
                        msg = f"Nenhuma transportadora disponível para este CEP. Detalhes: {', '.join(erros[:3])}"
                        return [], msg
                    return options, None
                elif response.status_code == 401:
                    return [], "Token da Melhor Envio inválido ou expirado. Atualize o token nas configurações."
                elif response.status_code == 422:
                    return [], f"Dados inválidos para cálculo de frete: {response.text[:200]}"
                else:
                    last_error = f"Erro {response.status_code}: {response.text[:200]}"
                    print(f"MELHORENVIO_ERROR: {last_error}")
            except requests.exceptions.Timeout:
                last_error = "Timeout ao conectar com a Melhor Envio. Serviço pode estar indisponível."
                print(f"Timeout na tentativa {attempt}")
            except requests.exceptions.ConnectionError as e:
                err_str = str(e)
                if "NameResolutionError" in err_str or "Name or service not known" in err_str or "Failed to resolve" in err_str:
                    last_error = "CONEXAO_INDISPONIVEL"
                    print(f"DNS resolution failed — abortando tentativas")
                    break  # Não adianta tentar novamente se o DNS falhou
                else:
                    last_error = f"Erro de conexão com a Melhor Envio: {err_str[:100]}"
                print(f"ConnectionError na tentativa {attempt}: {e}")
            except Exception as e:
                last_error = f"Erro inesperado: {str(e)[:100]}"
                print(f"Erro na tentativa {attempt}: {e}")

        return [], last_error or "Erro desconhecido ao calcular frete."
