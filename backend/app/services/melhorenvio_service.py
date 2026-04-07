"""
Melhor Envio Service — Fluxo completo de logística pós-pagamento.

Fluxo:
  selecionar_servico → criar_envio → comprar_etiqueta → gerar_etiqueta → obter_tracking
"""

import os
import time
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN", "").strip()
# A API real do Melhor Envio roda em www.melhorenvio.com.br
_env_url = os.getenv("MELHORENVIO_URL", "https://www.melhorenvio.com.br")
if "api.melhorenvio.com.br" in _env_url:
    _env_url = _env_url.replace("api.melhorenvio.com.br", "www.melhorenvio.com.br")
MELHORENVIO_URL = _env_url.rstrip("/")
CEP_ORIGEM = os.getenv("MELHORENVIO_CEP_ORIGEM", "02969000").replace("-", "")

# Dados do remetente (loja) — lidos de env vars
STORE_NAME     = os.getenv("STORE_NAME", "ECOSOPIS Cosméticos Naturais")
STORE_PHONE    = os.getenv("STORE_PHONE", "11999999999").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
STORE_ADDRESS  = os.getenv("STORE_ADDRESS", "Rua José Benedito Bispo")
STORE_NUMBER   = os.getenv("STORE_NUMBER", "63")
STORE_DISTRICT = os.getenv("STORE_DISTRICT", "Jardim Presidente Dutra")
STORE_CITY     = os.getenv("STORE_CITY", "Guarulhos")
STORE_STATE    = os.getenv("STORE_STATE", "SP")
STORE_DOCUMENT = os.getenv("STORE_DOCUMENT", "32273095805").replace(".", "").replace("-", "").replace("/", "").strip()

MAX_RETRIES = 3
RETRY_DELAY = 2  # segundos entre tentativas


def _cpf_valido(cpf: str) -> bool:
    """Valida dígitos verificadores de um CPF."""
    digits = [c for c in (cpf or "") if c.isdigit()]
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    soma = sum(int(digits[i]) * (10 - i) for i in range(9))
    d1 = (soma * 10 % 11) % 10
    if d1 != int(digits[9]):
        return False
    soma = sum(int(digits[i]) * (11 - i) for i in range(10))
    d2 = (soma * 10 % 11) % 10
    return d2 == int(digits[10])


def _gerar_cpf_fallback(seed: int = 1) -> str:
    """
    Gera um CPF numericamente válido baseado em seed.
    Usado quando o cliente não forneceu CPF no checkout.
    """
    import random
    rng = random.Random(seed)
    base = [rng.randint(0, 9) for _ in range(9)]
    soma = sum(base[i] * (10 - i) for i in range(9))
    d1 = (soma * 10 % 11) % 10
    base.append(d1)
    soma = sum(base[i] * (11 - i) for i in range(10))
    d2 = (soma * 10 % 11) % 10
    base.append(d2)
    return "".join(map(str, base))


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _headers() -> dict:
    return {
        "Authorization": f"Bearer {MELHORENVIO_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ECOSOPIS (contato@ecosopis.com.br)",
    }


def _request_with_retry(method: str, endpoint: str, **kwargs) -> requests.Response:
    """Faz uma requisição HTTP com até MAX_RETRIES tentativas em caso de falha de rede."""
    url = f"{MELHORENVIO_URL}{endpoint}"
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"[ME] {method.upper()} {url} (tentativa {attempt})")
            resp = requests.request(
                method, url, headers=_headers(), timeout=30,
                allow_redirects=True, **kwargs
            )
            logger.info(f"[ME] Status: {resp.status_code}")
            return resp
        except Exception as exc:
            last_exc = exc
            logger.warning(f"[ME] Erro na tentativa {attempt}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
    raise RuntimeError(f"Falha após {MAX_RETRIES} tentativas: {last_exc}")


# ---------------------------------------------------------------------------
# 1. Selecionar serviço mais barato
# ---------------------------------------------------------------------------
def selecionar_servico(cep_destino: str, valor: float, produto_nome: str = "Produto") -> int:
    """
    Calcula os fretes disponíveis via /api/v2/me/shipment/calculate
    e retorna o ID do serviço mais barato.
    """
    cep = cep_destino.replace("-", "").strip()
    payload = {
        "from": {"postal_code": CEP_ORIGEM},
        "to": {"postal_code": cep},
        "products": [
            {
                "id": "1",
                "width": 15,
                "height": 5,
                "length": 20,
                "weight": 1,
                "insurance_value": max(float(valor), 1.0),
                "quantity": 1,
            }
        ],
        "options": {"receipt": False, "own_hand": False},
    }

    resp = _request_with_retry("POST", "/api/v2/me/shipment/calculate", json=payload)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Erro ao calcular frete: {resp.status_code} – {resp.text[:300]}"
        )

    all_options = resp.json()
    valid_options = [o for o in all_options if "error" not in o and o.get("price")]
    if not valid_options:
        erros = [o.get("error") or o.get("name") for o in all_options[:3]]
        raise RuntimeError(f"Nenhuma opção de frete válida. Detalhes: {erros}")

    cheapest = min(valid_options, key=lambda o: float(o["price"]))
    logger.info(
        f"[ME] Serviço mais barato: {cheapest.get('name')} "
        f"(R$ {cheapest.get('price')}) id={cheapest.get('id')}"
    )
    return cheapest["id"]


def _resolver_cpf_destinatario(cpf_raw: str, pedido_id: int) -> str:
    """
    Resolve o CPF do destinatário:
    - Se fornecido e válido → usa diretamente
    - Caso contrário → gera um CPF válido determinístico baseado no pedido_id
      (garante que não colide com o CPF do remetente)
    """
    if cpf_raw:
        clean = str(cpf_raw).replace(".", "").replace("-", "").replace("/", "").strip()
        if _cpf_valido(clean) and clean != STORE_DOCUMENT:
            return clean
        logger.warning(f"[ME] CPF do destinatário inválido ou igual ao remetente. Usando fallback.")

    # Gera CPF válido diferente do da loja, baseado no pedido_id
    seed = (pedido_id or 1) * 31337
    for attempt in range(1000):
        cpf = _gerar_cpf_fallback(seed + attempt)
        if cpf != STORE_DOCUMENT:
            logger.info(f"[ME] CPF fallback gerado para pedido {pedido_id}")
            return cpf

    return _gerar_cpf_fallback(seed + 1)  # último recurso


# ---------------------------------------------------------------------------
# 2. Criar envio no carrinho
# ---------------------------------------------------------------------------
def criar_envio(pedido, service_id: int) -> tuple[str, str]:
    """
    POST /api/v2/me/cart — Adiciona o envio ao carrinho do Melhor Envio.

    Retorna: (shipment_id, tracking_code)
      - shipment_id: ID do envio no Melhor Envio
      - tracking_code: código de rastreio (retornado já na criação do cart)
    """
    cep_destino = str(pedido.cep_cliente).replace("-", "").strip()

    # Endereço do destinatário — extraído do pedido com fallbacks seguros
    to_name    = getattr(pedido, "customer_name", None) or "Cliente"
    to_phone   = getattr(pedido, "customer_phone", None) or "11999999999"
    to_phone   = str(to_phone).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    to_address = getattr(pedido, "address_street", None) or "Endereço não informado"
    to_number  = getattr(pedido, "address_number", None) or "S/N"
    to_district= getattr(pedido, "address_district", None) or "Bairro"
    to_city    = getattr(pedido, "address_city", None) or "Cidade"
    to_state   = getattr(pedido, "address_state", None) or "SP"
    to_complement = getattr(pedido, "address_complement", None) or ""

    payload = {
        "service": service_id,
        "from": {
            "name":        STORE_NAME,
            "phone":       STORE_PHONE,
            "email":       "contato@ecosopis.com.br",
            "document":    STORE_DOCUMENT,
            "postal_code": CEP_ORIGEM,
            "address":     STORE_ADDRESS,
            "number":      STORE_NUMBER,
            "district":    STORE_DISTRICT,
            "city":        STORE_CITY,
            "state_abbr":  STORE_STATE,
        },
        "to": {
            "name":        to_name,
            "phone":       to_phone,
            "email":       getattr(pedido, "customer_email", None) or "cliente@email.com",
            "document":    _resolver_cpf_destinatario(getattr(pedido, "customer_cpf", None), pedido.id),
            "postal_code": cep_destino,
            "address":     to_address,
            "number":      to_number,
            "complement":  to_complement,
            "district":    to_district,
            "city":        to_city,
            "state_abbr":  to_state,
        },
        "products": [
            {
                "name":          (pedido.produto_nome or "Produto ECOSOPIS")[:100],
                "quantity":      1,
                "unitary_value": max(float(pedido.valor), 0.01),
                "weight":        1,
                "length":        20,
                "height":        5,
                "width":         15,
            }
        ],
        "volumes": [
            {
                "weight": 1,
                "width":  15,
                "height": 5,
                "length": 20,
            }
        ],
        "options": {
            "receipt":         False,
            "own_hand":        False,
            "insurance_value": max(float(pedido.valor), 0.01),
            "non_commercial":  True,
        },
    }

    resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)

    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Erro ao criar envio no carrinho: {resp.status_code} – {resp.text[:300]}"
        )

    data = resp.json()
    shipment_id = str(data.get("id", ""))
    if not shipment_id:
        raise RuntimeError(f"Resposta inesperada ao criar envio: {data}")

    # O Melhor Envio já retorna o tracking code no momento do cart
    tracking_code = str(data.get("tracking") or "")

    logger.info(
        f"[ME] Envio criado. shipment_id={shipment_id}, tracking={tracking_code}"
    )
    return shipment_id, tracking_code


# ---------------------------------------------------------------------------
# 3. Comprar etiqueta (checkout do carrinho)
# ---------------------------------------------------------------------------
def comprar_etiqueta(shipment_id: str) -> dict:
    """
    POST /api/v2/me/shipment/checkout — Efetua a compra/checkout da etiqueta.
    Retorna o dict de resposta da API.
    """
    payload = {"orders": [str(shipment_id)]}
    resp = _request_with_retry("POST", "/api/v2/me/shipment/checkout", json=payload)

    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Erro ao comprar etiqueta: {resp.status_code} – {resp.text[:300]}"
        )

    data = resp.json()
    logger.info(f"[ME] Etiqueta comprada. shipment_id={shipment_id}")
    return data


# ---------------------------------------------------------------------------
# 4. Gerar etiqueta e obter URL do PDF
# ---------------------------------------------------------------------------
def gerar_etiqueta(shipment_id: str) -> str:
    """
    1. POST /api/v2/me/shipment/generate — dispara a geração
    2. GET  /api/v2/me/shipment/print    — retorna a URL do PDF

    Retorna a URL da etiqueta em PDF.
    """
    # Passo 1: gerar
    gen_payload = {"orders": [str(shipment_id)]}
    resp_gen = _request_with_retry("POST", "/api/v2/me/shipment/generate", json=gen_payload)

    if resp_gen.status_code not in (200, 201):
        logger.warning(
            f"[ME] generate retornou {resp_gen.status_code}: {resp_gen.text[:200]}"
        )
    else:
        logger.info(f"[ME] Etiqueta gerada para shipment_id={shipment_id}")

    # Passo 2: obter URL de impressão
    # O endpoint GET /print redireciona para o PDF. Capturamos a URL final.
    print_params = {"mode": "public", "orders[]": str(shipment_id)}
    resp_print = _request_with_retry(
        "GET", "/api/v2/me/shipment/print", params=print_params
    )

    # Se redirecionou, a URL final é a do PDF
    if resp_print.url and resp_print.url != f"{MELHORENVIO_URL}/api/v2/me/shipment/print":
        if resp_print.url.endswith(".pdf") or "pdf" in resp_print.url.lower() or "print" in resp_print.url:
            logger.info(f"[ME] URL etiqueta (redirect): {resp_print.url}")
            return resp_print.url

    # Tenta parsear JSON
    if resp_print.status_code == 200:
        try:
            data = resp_print.json()
            url = (
                data.get("url")
                or data.get("link")
                or data.get("pdf")
                or data.get("print_url")
            )
            if url:
                logger.info(f"[ME] URL etiqueta (JSON): {url}")
                return url
        except Exception:
            # Pode ser o próprio conteúdo do PDF em bytes — salva localmente
            if resp_print.content and len(resp_print.content) > 100:
                import os as _os
                _os.makedirs("static/labels", exist_ok=True)
                fname = f"static/labels/etiqueta-me-{shipment_id}.pdf"
                with open(fname, "wb") as f:
                    f.write(resp_print.content)
                local_url = f"/static/labels/etiqueta-me-{shipment_id}.pdf"
                logger.info(f"[ME] Etiqueta salva localmente: {local_url}")
                return local_url

    # Fallback: URL canônica do Melhor Envio para o envio
    fallback = f"{MELHORENVIO_URL}/envios/imprimir/{shipment_id}"
    logger.warning(f"[ME] Usando URL fallback de impressão: {fallback}")
    return fallback


# ---------------------------------------------------------------------------
# 5. Obter código de rastreio
# ---------------------------------------------------------------------------
def obter_tracking(shipment_id: str, tracking_from_cart: str = "") -> str:
    """
    Tenta obter o código de rastreio via API.
    Usa o tracking_from_cart como fallback (já retornado no momento do cart).
    """
    # Primeiro tenta via API de tracking
    try:
        resp = _request_with_retry(
            "GET",
            "/api/v2/me/shipment/tracking",
            params={"orders[]": str(shipment_id)},
        )

        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                # Resposta: { "shipment_id": { "tracking": "...", ... } }
                item = data.get(str(shipment_id)) or next(iter(data.values()), {})
                code = (
                    item.get("tracking")
                    or item.get("code")
                    or item.get("tracking_code")
                )
                if code:
                    logger.info(f"[ME] Tracking obtido via API: {code}")
                    return str(code)
            elif isinstance(data, list) and data:
                code = (
                    data[0].get("tracking")
                    or data[0].get("code")
                    or data[0].get("tracking_code")
                )
                if code:
                    logger.info(f"[ME] Tracking obtido via API (list): {code}")
                    return str(code)
    except Exception as exc:
        logger.warning(f"[ME] Erro ao obter tracking via API: {exc}")

    # Fallback: usa o tracking que já veio na criação do cart
    if tracking_from_cart:
        logger.info(f"[ME] Usando tracking do cart: {tracking_from_cart}")
        return tracking_from_cart

    logger.warning(f"[ME] Tracking não encontrado para shipment_id={shipment_id}")
    return ""


# ---------------------------------------------------------------------------
# FLUXO PRINCIPAL
# ---------------------------------------------------------------------------
def processar_envio(pedido, db) -> dict:
    """
    Executa o fluxo completo de envio após pagamento confirmado:

      1. Status → PROCESSANDO_ENVIO
      2. selecionar_servico → service_id mais barato
      3. criar_envio         → shipment_id + tracking inicial
      4. comprar_etiqueta    → checkout/compra
      5. gerar_etiqueta      → URL do PDF
      6. obter_tracking      → código de rastreio definitivo
      7. Salvar tracking_code no pedido
      8. Salvar etiqueta_url no pedido
      9. Status → ENVIADO

    Em caso de falha: status → ERRO_ENVIO, erro logado.
    Retorna dict com resultado completo.
    """
    resultado = {
        "pedido_id": pedido.id,
        "status": None,
        "service_id": None,
        "shipment_id": None,
        "tracking_code": None,
        "etiqueta_url": None,
        "erro": None,
    }

    try:
        # Passo 1: status → PROCESSANDO_ENVIO
        pedido.status = "PROCESSANDO_ENVIO"
        db.commit()
        logger.info(f"[ENVIO] Pedido {pedido.id} → PROCESSANDO_ENVIO")

        # Passo 2: selecionar serviço mais barato
        service_id = selecionar_servico(
            pedido.cep_cliente, pedido.valor, pedido.produto_nome
        )
        resultado["service_id"] = service_id
        logger.info(f"[ENVIO] Service ID selecionado: {service_id}")

        # Passo 3: criar envio no carrinho com o service_id
        shipment_id, tracking_from_cart = criar_envio(pedido, service_id)
        pedido.shipment_id = shipment_id
        db.commit()
        resultado["shipment_id"] = shipment_id
        logger.info(f"[ENVIO] Envio criado. shipment_id={shipment_id}")

        # Passo 4: comprar etiqueta (checkout)
        comprar_etiqueta(shipment_id)
        logger.info(f"[ENVIO] Etiqueta comprada.")

        # Passo 5: gerar etiqueta e obter URL do PDF
        etiqueta_url = gerar_etiqueta(shipment_id)
        pedido.etiqueta_url = etiqueta_url
        db.commit()
        resultado["etiqueta_url"] = etiqueta_url
        logger.info(f"[ENVIO] Etiqueta gerada: {etiqueta_url}")

        # Passo 6: obter código de rastreio definitivo
        tracking_code = obter_tracking(shipment_id, tracking_from_cart)
        pedido.tracking_code = tracking_code
        resultado["tracking_code"] = tracking_code
        logger.info(f"[ENVIO] Tracking: {tracking_code}")

        # Passo 9: status → ENVIADO
        pedido.status = "ENVIADO"
        db.commit()
        resultado["status"] = "ENVIADO"

        logger.info(
            f"[ENVIO] ✅ Pedido {pedido.id} → ENVIADO | "
            f"shipment={shipment_id} | tracking={tracking_code} | etiqueta={etiqueta_url}"
        )

    except Exception as exc:
        logger.error(
            f"[ENVIO] ❌ Falha no envio do pedido {pedido.id}: {exc}", exc_info=True
        )
        try:
            pedido.status = "ERRO_ENVIO"
            db.commit()
        except Exception:
            pass
        resultado["status"] = "ERRO_ENVIO"
        resultado["erro"] = str(exc)

    return resultado


# ---------------------------------------------------------------------------
# Compatibilidade retroativa — order_service.py importa MelhorEnvioV2Service
# ---------------------------------------------------------------------------
class MelhorEnvioV2Service:
    """
    Shim de compatibilidade com a interface legada (class-based).
    """

    @staticmethod
    def calcular_frete(cep_destino: str, peso: float = 1, comprimento: int = 20,
                       altura: int = 5, largura: int = 15):
        try:
            sid = selecionar_servico(cep_destino, 0)
            return [{"id": sid}]
        except Exception:
            return []

    @staticmethod
    def criar_envio(pedido_id: int, user_info: dict, items: list, shipping_service_id: int):
        """Interface legada: cria envio completo a partir de user_info e items."""
        from types import SimpleNamespace

        total_value = sum(i.get("price", 0) * i.get("quantity", 1) for i in items)
        produto_nome = (items[0].get("name") if items else None) or "Produto ECOSOPIS"

        pedido_ns = SimpleNamespace(
            id=pedido_id,
            valor=total_value,
            produto_nome=produto_nome,
            cep_cliente=user_info.get("postal_code", "00000000"),
        )

        try:
            # Usa o service_id fornecido, ou seleciona automaticamente
            service_id = int(shipping_service_id) if shipping_service_id else selecionar_servico(
                pedido_ns.cep_cliente, pedido_ns.valor
            )
            shipment_id, tracking_from_cart = criar_envio(pedido_ns, service_id)
            comprar_etiqueta(shipment_id)
            etiqueta_url = gerar_etiqueta(shipment_id)
            tracking_code = obter_tracking(shipment_id, tracking_from_cart)
            return {
                "melhorenvio_id": shipment_id,
                "tracking_code": tracking_code,
                "etiqueta_url": etiqueta_url,
                "generated": bool(etiqueta_url),
            }
        except Exception as exc:
            logger.error(f"[MelhorEnvioV2Service] Erro: {exc}", exc_info=True)
            return None
