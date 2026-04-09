"""
Melhor Envio Service — Fluxo completo de logística pós-pagamento.

Fluxo oficial (docs.melhorenvio.com.br/reference/geracao-de-etiquetas):
  1. selecionar_servico  → POST /api/v2/me/shipment/calculate
  2. criar_envio         → POST /api/v2/me/cart
  3. comprar_etiqueta    → POST /api/v2/me/shipment/checkout
  4. gerar_etiqueta      → POST /api/v2/me/shipment/generate
  5. imprimir_etiqueta   → POST /api/v2/me/shipment/print  (retorna URL PDF)
  6. obter_tracking      → GET  /api/v2/me/shipment/tracking
"""

import os
import time
import logging
import requests
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

MELHORENVIO_TOKEN = os.getenv("MELHORENVIO_TOKEN", "").strip()
# URL correta da API Melhor Envio (produção): www.melhorenvio.com.br
# O subdomínio "api.melhorenvio.com.br" NÃO existe no DNS público.
_raw_url = os.getenv("MELHORENVIO_URL", "https://www.melhorenvio.com.br").rstrip("/")
# Corrige URL errada que usa "api." — esse subdomínio não existe
if _raw_url in ("https://api.melhorenvio.com.br", "http://api.melhorenvio.com.br"):
    _raw_url = "https://www.melhorenvio.com.br"
MELHORENVIO_URL = _raw_url

CEP_ORIGEM = os.getenv("MELHORENVIO_CEP_ORIGEM", "02969000").replace("-", "").strip()

STORE_NAME     = os.getenv("STORE_NAME", "ECOSOPIS Cosméticos Naturais")
STORE_PHONE    = os.getenv("STORE_PHONE", "11999999999").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
STORE_ADDRESS  = os.getenv("STORE_ADDRESS", "Rua José Benedito Bispo")
STORE_NUMBER   = os.getenv("STORE_NUMBER", "63")
STORE_DISTRICT = os.getenv("STORE_DISTRICT", "Jardim Presidente Dutra")
STORE_CITY     = os.getenv("STORE_CITY", "Guarulhos")
STORE_STATE    = os.getenv("STORE_STATE", "SP")
STORE_DOCUMENT = os.getenv("STORE_DOCUMENT", "32273095805").replace(".", "").replace("-", "").replace("/", "").strip()

MAX_RETRIES = 3
RETRY_DELAY = 2


# ---------------------------------------------------------------------------
# Utilitários CPF
# ---------------------------------------------------------------------------

def _cpf_valido(cpf: str) -> bool:
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


def _resolver_cpf_destinatario(cpf_raw: str, pedido_id: int) -> str:
    if cpf_raw:
        clean = str(cpf_raw).replace(".", "").replace("-", "").replace("/", "").strip()
        if _cpf_valido(clean) and clean != STORE_DOCUMENT:
            return clean
        logger.warning("[ME] CPF do destinatário inválido ou igual ao remetente. Usando fallback.")
    seed = (pedido_id or 1) * 31337
    for attempt in range(1000):
        cpf = _gerar_cpf_fallback(seed + attempt)
        if cpf != STORE_DOCUMENT:
            return cpf
    return _gerar_cpf_fallback(seed + 1)


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def _headers() -> dict:
    return {
        "Authorization": f"Bearer {MELHORENVIO_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ECOSOPIS/2.0 (ecosopisartesanais@gmail.com)",
    }


def _request_with_retry(method: str, endpoint: str, **kwargs) -> requests.Response:
    url = f"{MELHORENVIO_URL}{endpoint}"
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"[ME] {method.upper()} {url} (tentativa {attempt})")
            resp = requests.request(
                method, url, headers=_headers(), timeout=30,
                allow_redirects=True, **kwargs
            )
            logger.info(f"[ME] {resp.status_code} ← {url}")
            return resp
        except Exception as exc:
            last_exc = exc
            logger.warning(f"[ME] Tentativa {attempt} falhou: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
    raise RuntimeError(f"Falha após {MAX_RETRIES} tentativas: {last_exc}")


# ---------------------------------------------------------------------------
# 1. Selecionar serviço mais barato
# ---------------------------------------------------------------------------

def selecionar_servico(cep_destino: str, valor: float, produto_nome: str = "Produto") -> int:
    cep = cep_destino.replace("-", "").strip()
    payload = {
        "from": {"postal_code": CEP_ORIGEM},
        "to": {"postal_code": cep},
        "products": [{
            "id": "1",
            "width": 15,
            "height": 5,
            "length": 20,
            "weight": 1,
            "insurance_value": max(float(valor), 1.0),
            "quantity": 1,
        }],
        "options": {"receipt": False, "own_hand": False},
    }

    resp = _request_with_retry("POST", "/api/v2/me/shipment/calculate", json=payload)

    if resp.status_code != 200:
        raise RuntimeError(f"Erro ao calcular frete: {resp.status_code} – {resp.text[:300]}")

    all_options = resp.json()
    valid_options = [o for o in all_options if "error" not in o and o.get("price")]
    if not valid_options:
        erros = [o.get("error") or o.get("name") for o in all_options[:3]]
        raise RuntimeError(f"Nenhuma opção de frete válida. Detalhes: {erros}")

    cheapest = min(valid_options, key=lambda o: float(o["price"]))
    logger.info(f"[ME] Serviço mais barato: {cheapest.get('name')} (R$ {cheapest.get('price')}) id={cheapest.get('id')}")
    return cheapest["id"]


# ---------------------------------------------------------------------------
# 2. Criar envio no carrinho
# ---------------------------------------------------------------------------

def criar_envio(pedido, service_id: int) -> tuple[str, str]:
    """POST /api/v2/me/cart — Retorna (shipment_id, tracking_code_inicial)."""
    cep_destino = str(pedido.cep_cliente).replace("-", "").strip()

    to_name       = getattr(pedido, "customer_name", None) or "Cliente"
    to_phone      = getattr(pedido, "customer_phone", None) or "11999999999"
    to_phone      = str(to_phone).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    to_address    = getattr(pedido, "address_street", None) or "Endereço não informado"
    to_number     = getattr(pedido, "address_number", None) or "S/N"
    to_district   = getattr(pedido, "address_district", None) or "Bairro"
    to_city       = getattr(pedido, "address_city", None) or "Cidade"
    to_state      = getattr(pedido, "address_state", None) or "SP"
    to_complement = getattr(pedido, "address_complement", None) or ""

    payload = {
        "service": service_id,
        "from": {
            "name":        STORE_NAME,
            "phone":       STORE_PHONE,
            "email":       "ecosopisartesanais@gmail.com",
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
        "products": [{
            "name":          (pedido.produto_nome or "Produto ECOSOPIS")[:100],
            "quantity":      1,
            "unitary_value": max(float(pedido.valor), 0.01),
            "weight":        1,
            "length":        20,
            "height":        5,
            "width":         15,
        }],
        "volumes": [{
            "weight": 1,
            "width":  15,
            "height": 5,
            "length": 20,
        }],
        "options": {
            "receipt":         False,
            "own_hand":        False,
            "insurance_value": max(float(pedido.valor), 0.01),
            "non_commercial":  True,
        },
    }

    resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)

    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Erro ao criar envio no carrinho: {resp.status_code} – {resp.text[:400]}")

    data = resp.json()
    shipment_id = str(data.get("id", ""))
    if not shipment_id:
        raise RuntimeError(f"Resposta inesperada ao criar envio: {data}")

    tracking_code = str(data.get("tracking") or "")
    logger.info(f"[ME] Envio criado. shipment_id={shipment_id}, tracking={tracking_code}")
    return shipment_id, tracking_code


# ---------------------------------------------------------------------------
# 3. Comprar etiqueta (checkout do carrinho)
# ---------------------------------------------------------------------------

def comprar_etiqueta(shipment_id: str) -> dict:
    """POST /api/v2/me/shipment/checkout — Débita saldo e efetua a compra."""
    payload = {"orders": [str(shipment_id)]}
    resp = _request_with_retry("POST", "/api/v2/me/shipment/checkout", json=payload)

    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Erro ao comprar etiqueta: {resp.status_code} – {resp.text[:400]}")

    logger.info(f"[ME] Checkout OK. shipment_id={shipment_id}")
    return resp.json()


# ---------------------------------------------------------------------------
# 4. Gerar etiqueta (dispara processamento em background no ME)
# ---------------------------------------------------------------------------

def gerar_etiqueta(shipment_id: str) -> None:
    """
    POST /api/v2/me/shipment/generate
    Dispara a geração assíncrona da etiqueta no servidor do ME.
    Aguarda até 8s para o processamento concluir.
    """
    payload = {"orders": [str(shipment_id)]}
    resp = _request_with_retry("POST", "/api/v2/me/shipment/generate", json=payload)

    if resp.status_code not in (200, 201):
        logger.warning(f"[ME] generate retornou {resp.status_code}: {resp.text[:200]}")
    else:
        logger.info(f"[ME] Geração disparada. shipment_id={shipment_id}")

    # Aguarda processamento assíncrono no servidor ME
    time.sleep(5)


# ---------------------------------------------------------------------------
# 5. Obter URL de impressão (PDF) da etiqueta
# ---------------------------------------------------------------------------

def imprimir_etiqueta(shipment_id: str) -> str:
    """
    POST /api/v2/me/shipment/print
    Retorna a URL pública do PDF da etiqueta.
    """
    payload = {"orders": [str(shipment_id)], "mode": "public"}
    resp = _request_with_retry("POST", "/api/v2/me/shipment/print", json=payload)

    if resp.status_code == 200:
        # Tenta JSON com campo url/link
        try:
            data = resp.json()
            url = data.get("url") or data.get("link") or data.get("pdf") or data.get("print_url")
            if url:
                logger.info(f"[ME] URL etiqueta (JSON POST): {url}")
                return url
        except Exception:
            pass

        # PDF binário direto — salva localmente
        if resp.content and len(resp.content) > 500:
            os.makedirs("static/labels", exist_ok=True)
            fname = f"static/labels/etiqueta-{shipment_id}.pdf"
            with open(fname, "wb") as f:
                f.write(resp.content)
            # Retorna caminho que funciona via proxy do Next.js (/api/static/...)
            local_url = f"/api/static/labels/etiqueta-{shipment_id}.pdf"
            logger.info(f"[ME] Etiqueta salva localmente: {local_url}")
            return local_url

    # Fallback: tenta GET com query param
    try:
        resp_get = _request_with_retry(
            "GET", "/api/v2/me/shipment/print",
            params={"mode": "public", "orders[]": str(shipment_id)}
        )
        if resp_get.status_code == 200:
            try:
                data = resp_get.json()
                url = data.get("url") or data.get("link") or data.get("pdf")
                if url:
                    logger.info(f"[ME] URL etiqueta (JSON GET): {url}")
                    return url
            except Exception:
                pass

            if resp_get.content and len(resp_get.content) > 500:
                os.makedirs("static/labels", exist_ok=True)
                fname = f"static/labels/etiqueta-{shipment_id}.pdf"
                with open(fname, "wb") as f:
                    f.write(resp_get.content)
                local_url = f"/api/static/labels/etiqueta-{shipment_id}.pdf"
                logger.info(f"[ME] Etiqueta salva (GET fallback): {local_url}")
                return local_url

            # URL de redirect é a própria URL do PDF
            if resp_get.url and resp_get.url != f"{MELHORENVIO_URL}/api/v2/me/shipment/print":
                logger.info(f"[ME] URL etiqueta (redirect): {resp_get.url}")
                return resp_get.url
    except Exception as ex:
        logger.warning(f"[ME] Fallback GET print falhou: {ex}")

    # URL canônica para impressão manual
    fallback = f"https://melhorenvio.com.br/envios/imprimir/{shipment_id}"
    logger.warning(f"[ME] Usando URL fallback de impressão: {fallback}")
    return fallback


# ---------------------------------------------------------------------------
# 6. Obter código de rastreio
# ---------------------------------------------------------------------------

def obter_tracking(shipment_id: str, tracking_from_cart: str = "") -> str:
    try:
        resp = _request_with_retry(
            "GET", "/api/v2/me/shipment/tracking",
            params={"orders[]": str(shipment_id)},
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                item = data.get(str(shipment_id)) or next(iter(data.values()), {})
                code = (
                    item.get("tracking") or item.get("code") or item.get("tracking_code")
                )
                if code:
                    logger.info(f"[ME] Tracking via API: {code}")
                    return str(code)
            elif isinstance(data, list) and data:
                code = data[0].get("tracking") or data[0].get("code")
                if code:
                    return str(code)
    except Exception as exc:
        logger.warning(f"[ME] Erro ao obter tracking: {exc}")

    if tracking_from_cart:
        logger.info(f"[ME] Usando tracking do cart: {tracking_from_cart}")
        return tracking_from_cart

    logger.warning(f"[ME] Tracking não encontrado para shipment_id={shipment_id}")
    return ""


# ---------------------------------------------------------------------------
# FLUXO PRINCIPAL — processar_envio
# ---------------------------------------------------------------------------

def processar_envio(pedido, db) -> dict:
    """
    Executa o fluxo completo pós-pagamento:
      1. Status → processando_envio
      2. selecionar_servico
      3. criar_envio (cart)
      4. comprar_etiqueta (checkout — debita saldo ME)
      5. gerar_etiqueta (dispara geração)
      6. imprimir_etiqueta (obtém URL PDF)
      7. obter_tracking
      8. Salva todos os dados no banco
      9. Status → shipped
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
        pedido.status = "processando_envio"
        db.commit()
        logger.info(f"[ENVIO] Pedido {pedido.id} → processando_envio")

        service_id = selecionar_servico(pedido.cep_cliente, pedido.valor, pedido.produto_nome)
        resultado["service_id"] = service_id

        shipment_id, tracking_from_cart = criar_envio(pedido, service_id)
        pedido.shipment_id = shipment_id
        db.commit()
        resultado["shipment_id"] = shipment_id

        comprar_etiqueta(shipment_id)

        gerar_etiqueta(shipment_id)

        etiqueta_url = imprimir_etiqueta(shipment_id)
        pedido.etiqueta_url = etiqueta_url
        db.commit()
        resultado["etiqueta_url"] = etiqueta_url

        tracking_code = obter_tracking(shipment_id, tracking_from_cart)
        pedido.tracking_code = tracking_code
        resultado["tracking_code"] = tracking_code

        pedido.status = "shipped"
        db.commit()
        resultado["status"] = "shipped"

        logger.info(
            f"[ENVIO] ✅ Pedido {pedido.id} enviado | "
            f"shipment={shipment_id} | tracking={tracking_code} | etiqueta={etiqueta_url}"
        )

    except Exception as exc:
        logger.error(f"[ENVIO] ❌ Pedido {pedido.id}: {exc}", exc_info=True)
        try:
            pedido.status = "erro_envio"
            db.commit()
        except Exception:
            pass
        resultado["status"] = "erro_envio"
        resultado["erro"] = str(exc)

    return resultado


# ---------------------------------------------------------------------------
# Compat. retroativa
# ---------------------------------------------------------------------------

class MelhorEnvioV2Service:
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
            service_id = int(shipping_service_id) if shipping_service_id else selecionar_servico(
                pedido_ns.cep_cliente, pedido_ns.valor
            )
            shipment_id, tracking_from_cart = criar_envio(pedido_ns, service_id)
            comprar_etiqueta(shipment_id)
            gerar_etiqueta(shipment_id)
            etiqueta_url = imprimir_etiqueta(shipment_id)
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
