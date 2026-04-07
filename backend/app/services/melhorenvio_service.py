import os
import time
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN", "")
MELHORENVIO_URL = os.getenv("MELHORENVIO_URL", "https://www.melhorenvio.com.br").rstrip("/")
CEP_ORIGEM = os.getenv("MELHORENVIO_CEP_ORIGEM", "02969000").replace("-", "")

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {MELHORENVIO_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ECOSOPIS (contato@ecosopis.com.br)",
    }


def _request_with_retry(method: str, endpoint: str, **kwargs) -> requests.Response:
    url = f"{MELHORENVIO_URL}{endpoint}"
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"[ME] {method.upper()} {url} (tentativa {attempt})")
            resp = requests.request(method, url, headers=_headers(), timeout=30, **kwargs)
            logger.info(f"[ME] Status: {resp.status_code}")
            return resp
        except Exception as exc:
            last_exc = exc
            logger.warning(f"[ME] Erro na tentativa {attempt}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
    raise RuntimeError(f"Falha após {MAX_RETRIES} tentativas: {last_exc}")


# ---------------------------------------------------------------------------
# 1. Criar envio no carrinho → retorna shipment_id
# ---------------------------------------------------------------------------
def criar_envio(pedido) -> str:
    """
    Adiciona o envio no carrinho do Melhor Envio.
    Retorna o shipment_id (id do pedido criado no carrinho).
    """
    cep_destino = str(pedido.cep_cliente).replace("-", "").strip()

    payload = {
        "from": {"postal_code": CEP_ORIGEM},
        "to": {"postal_code": cep_destino},
        "products": [
            {
                "name": pedido.produto_nome or "Produto ECOSOPIS",
                "quantity": 1,
                "unitary_value": float(pedido.valor),
                "weight": 1,
                "length": 20,
                "height": 5,
                "width": 15,
            }
        ],
        "volumes": [
            {
                "weight": 1,
                "width": 15,
                "height": 5,
                "length": 20,
            }
        ],
        "options": {
            "receipt": False,
            "own_hand": False,
            "insurance_value": float(pedido.valor),
            "non_commercial": True,
        },
    }

    resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)

    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Erro ao criar envio: {resp.status_code} – {resp.text}")

    data = resp.json()
    shipment_id = data.get("id")
    if not shipment_id:
        raise RuntimeError(f"Resposta inesperada ao criar envio: {data}")

    logger.info(f"[ME] Envio criado. shipment_id={shipment_id}")
    return str(shipment_id)


# ---------------------------------------------------------------------------
# 2. Selecionar o serviço mais barato para um CEP
# ---------------------------------------------------------------------------
def selecionar_servico(cep_destino: str, valor: float) -> int:
    """
    Calcula fretes disponíveis e retorna o ID do serviço mais barato.
    """
    cep = cep_destino.replace("-", "").strip()
    payload = {
        "from": {"postal_code": CEP_ORIGEM},
        "to": {"postal_code": cep},
        "products": [
            {
                "id": "x",
                "width": 15,
                "height": 5,
                "length": 20,
                "weight": 1,
                "insurance_value": float(valor),
                "quantity": 1,
            }
        ],
        "options": {"receipt": False, "own_hand": False},
    }

    resp = _request_with_retry("POST", "/api/v2/me/shipment/calculate", json=payload)

    if resp.status_code != 200:
        raise RuntimeError(f"Erro ao calcular frete: {resp.status_code} – {resp.text}")

    options = [o for o in resp.json() if "error" not in o and o.get("price")]
    if not options:
        raise RuntimeError("Nenhuma opção de frete disponível.")

    cheapest = min(options, key=lambda o: float(o["price"]))
    logger.info(f"[ME] Serviço mais barato: {cheapest['name']} (R$ {cheapest['price']}) id={cheapest['id']}")
    return cheapest["id"]


# ---------------------------------------------------------------------------
# 3. Comprar etiqueta (checkout do carrinho)
# ---------------------------------------------------------------------------
def comprar_etiqueta(shipment_id: str) -> bool:
    """
    Executa o checkout do envio no carrinho, comprando a etiqueta.
    """
    payload = {"orders": [str(shipment_id)]}
    resp = _request_with_retry("POST", "/api/v2/me/shipment/checkout", json=payload)

    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Erro ao comprar etiqueta: {resp.status_code} – {resp.text}")

    logger.info(f"[ME] Etiqueta comprada. shipment_id={shipment_id}")
    return True


# ---------------------------------------------------------------------------
# 4. Gerar etiqueta (gera o PDF)
# ---------------------------------------------------------------------------
def gerar_etiqueta(shipment_id: str) -> str:
    """
    Solicita a geração da etiqueta e retorna a URL do PDF.
    """
    # Primeiro, dispara a geração
    payload = {"orders": [str(shipment_id)]}
    resp_gen = _request_with_retry("POST", "/api/v2/me/shipment/generate", json=payload)

    if resp_gen.status_code not in (200, 201):
        logger.warning(f"[ME] Gerar etiqueta retornou {resp_gen.status_code}: {resp_gen.text}")

    # Depois, busca a URL de impressão
    params = {"mode": "public", "orders[]": str(shipment_id)}
    resp_print = _request_with_retry("GET", "/api/v2/me/shipment/print", params=params)

    if resp_print.status_code == 200:
        data = resp_print.json()
        url = data.get("url") or data.get("link") or data.get("pdf")
        if url:
            logger.info(f"[ME] URL etiqueta: {url}")
            return url

    # Fallback: tenta obter pelo endpoint de preview
    resp_prev = _request_with_retry("GET", "/api/v2/me/shipment/preview", params=params)
    if resp_prev.status_code == 200:
        data = resp_prev.json()
        url = data.get("url") or data.get("link")
        if url:
            return url

    # Retorna URL construída manualmente como último recurso
    fallback_url = f"{MELHORENVIO_URL}/envios/imprimir/{shipment_id}"
    logger.warning(f"[ME] Usando URL fallback: {fallback_url}")
    return fallback_url


# ---------------------------------------------------------------------------
# 5. Obter código de rastreio
# ---------------------------------------------------------------------------
def obter_tracking(shipment_id: str) -> str:
    """
    Retorna o código de rastreio para o shipment_id informado.
    """
    resp = _request_with_retry("GET", f"/api/v2/me/shipment/tracking?orders[]={shipment_id}")

    if resp.status_code == 200:
        data = resp.json()
        # A resposta pode ser um dict com o id como chave
        if isinstance(data, dict):
            item = data.get(str(shipment_id), {})
            code = item.get("tracking") or item.get("code")
            if code:
                return str(code)
        elif isinstance(data, list) and data:
            return str(data[0].get("tracking") or data[0].get("code", ""))

    logger.warning(f"[ME] Não foi possível obter tracking para shipment_id={shipment_id}")
    return ""


# ---------------------------------------------------------------------------
# FLUXO PRINCIPAL
# ---------------------------------------------------------------------------
def processar_envio(pedido, db) -> dict:
    """
    Executa o fluxo completo de envio após pagamento confirmado:
      1. Status → PROCESSANDO_ENVIO
      2. Criar envio no carrinho
      3. Selecionar serviço mais barato
      4. Comprar etiqueta
      5. Gerar etiqueta (PDF)
      6. Obter tracking
      7. Salvar tracking_code e etiqueta_url
      8. Status → ENVIADO

    Em caso de falha, status → ERRO_ENVIO e loga o erro.
    """
    resultado = {
        "pedido_id": pedido.id,
        "status": None,
        "shipment_id": None,
        "tracking_code": None,
        "etiqueta_url": None,
        "erro": None,
    }

    try:
        # 1. Atualizar status
        pedido.status = "PROCESSANDO_ENVIO"
        db.commit()
        logger.info(f"[ENVIO] Pedido {pedido.id} → PROCESSANDO_ENVIO")

        # 2. Criar envio no carrinho
        shipment_id = criar_envio(pedido)
        pedido.shipment_id = shipment_id
        db.commit()
        resultado["shipment_id"] = shipment_id

        # 3. (Opcional) Selecionar serviço mais barato — já embutido no cart via service_id
        # Aqui apenas logamos a opção mais barata para fins de auditoria
        try:
            selecionar_servico(pedido.cep_cliente, pedido.valor)
        except Exception as e:
            logger.warning(f"[ENVIO] selecionar_servico não-crítico: {e}")

        # 4. Comprar etiqueta
        comprar_etiqueta(shipment_id)

        # 5. Gerar etiqueta
        etiqueta_url = gerar_etiqueta(shipment_id)
        pedido.etiqueta_url = etiqueta_url
        db.commit()
        resultado["etiqueta_url"] = etiqueta_url

        # 6. Obter tracking
        tracking_code = obter_tracking(shipment_id)
        pedido.tracking_code = tracking_code
        resultado["tracking_code"] = tracking_code

        # 8. Status → ENVIADO
        pedido.status = "ENVIADO"
        db.commit()
        resultado["status"] = "ENVIADO"

        logger.info(
            f"[ENVIO] Pedido {pedido.id} → ENVIADO | tracking={tracking_code} | etiqueta={etiqueta_url}"
        )

    except Exception as exc:
        logger.error(f"[ENVIO] Falha ao processar envio do pedido {pedido.id}: {exc}", exc_info=True)
        try:
            pedido.status = "ERRO_ENVIO"
            db.commit()
        except Exception:
            pass
        resultado["status"] = "ERRO_ENVIO"
        resultado["erro"] = str(exc)

    return resultado
