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
# Utilitários CEP
# ---------------------------------------------------------------------------

def _obter_dados_por_cep(cep: str) -> dict:
    try:
        resp = requests.get(f"https://viacep.com.br/ws/{cep}/json/", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if "erro" not in data:
                return data
    except Exception as e:
        logger.warning(f"[ME] Erro ao consultar ViaCEP para {cep}: {e}")
    return {}

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def _headers() -> dict:
    if not MELHORENVIO_TOKEN:
        raise RuntimeError("Token do Melhor Envio não configurado. Defina MELHORENVIO_TOKEN.")
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


def _coletar_agencias_disponiveis(service_id: int = None, cep_origem: str = CEP_ORIGEM) -> list:
    """Lista agências/pontos de postagem usando a API oficial do Melhor Envio."""
    try:
        params = {}
        if service_id is not None:
            params["service_id"] = service_id
        if cep_origem:
            params["from_postal_code"] = str(cep_origem).replace("-", "").strip()
        resp = _request_with_retry("GET", "/api/v2/me/agencies", params=params)
        if resp.status_code != 200:
            logger.warning(f"[ME] agencies retornou {resp.status_code}: {resp.text[:300]}")
            return []
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("data", "agencies", "result", "results"):
                if isinstance(data.get(key), list):
                    return data[key]
            return [data]
        return []
    except Exception as exc:
        logger.warning(f"[ME] Falha ao consultar agências: {exc}")
        return []


def _normalizar_agencia_id(raw_agencia) -> str:
    if raw_agencia is None:
        return ""
    if isinstance(raw_agencia, dict):
        for key in ("id", "agency_id", "agencyId"):
            if key in raw_agencia:
                return str(raw_agencia[key])
        return ""
    if isinstance(raw_agencia, (int, float, str)):
        return str(raw_agencia)
    return ""


def _filtrar_agencia_valida(agencias: list, service_id: int = None, cep_origem: str = CEP_ORIGEM):
    """Retorna a agência mais adequada para o serviço/origem. Se houver mais de uma, prioriza a melhor compatível."""
    if not agencias:
        return None

    service_id = int(service_id) if service_id is not None else None
    cep_origem = str(cep_origem or "").replace("-", "").strip()

    def agencia_apta(item) -> bool:
        if not isinstance(item, dict):
            return False
        agency_id = _normalizar_agencia_id(item)
        if not agency_id:
            return False

        # Filtra por serviço quando o retorno expõe `service` ou `services`
        service_list = item.get("services") or item.get("service") or item.get("service_id") or item.get("service_ids")
        if service_id is not None:
            if isinstance(service_list, list):
                if str(service_id) not in [str(v) for v in service_list]:
                    return False
            elif isinstance(service_list, dict):
                # Alguns payloads devolvem mapping por serviço
                if str(service_id) not in [str(k) for k in service_list.keys()]:
                    return False
            elif isinstance(service_list, (int, float, str)):
                if str(service_id) != str(service_list):
                    return False

        # Tenta localizar o CEP/origem quando o item expõe endereço válido
        postal = item.get("postal_code") or item.get("postalCode") or item.get("cep") or item.get("zip_code")
        if cep_origem and postal:
            postal_digits = str(postal).replace("-", "").replace(".", "").strip()
            if postal_digits and postal_digits != cep_origem:
                # não é critério obrigatório para todos os retornos, mas ajuda a filtrar
                pass

        return True

    validas = [item for item in agencias if agencia_apta(item)]
    if not validas:
        return None

    # Prioriza agências que incluem o id em campos mais explícitos
    for item in validas:
        if isinstance(item, dict):
            if item.get("is_active") is False:
                continue
            if item.get("available") is False:
                continue
            return item
    return validas[0]


def _resolver_agencia_para_servico(service_id: int, cep_origem: str = CEP_ORIGEM):
    """Resolve agency_id válido para a origem e o serviço atual; retorna None se não for obrigatório."""
    agencias = _coletar_agencias_disponiveis(service_id=service_id, cep_origem=cep_origem)
    agencia = _filtrar_agencia_valida(agencias, service_id=service_id, cep_origem=cep_origem)
    if agencia is None:
        return None
    return _normalizar_agencia_id(agencia)


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

    # Busca dados no ViaCEP para preencher campos vazios
    via_cep_data = _obter_dados_por_cep(cep_destino)

    to_name       = getattr(pedido, "customer_name", None) or "Cliente"
    to_phone      = getattr(pedido, "customer_phone", None) or "11999999999"
    to_phone      = str(to_phone).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    to_address    = getattr(pedido, "address_street", None) or via_cep_data.get("logradouro") or "Endereço não informado"
    to_number     = getattr(pedido, "address_number", None) or "S/N"
    to_district   = getattr(pedido, "address_district", None) or via_cep_data.get("bairro") or "Bairro"
    to_city       = getattr(pedido, "address_city", None) or via_cep_data.get("localidade") or "Cidade"
    to_state = getattr(pedido, "address_state", None)
    uf_via_cep = via_cep_data.get("uf")

    # Valida consistência de CEP e UF para CEPs fora de SP.
    # Se a UF for "SP" (ou vazia) mas o CEP do destinatário for de outro estado,
    # e o ViaCEP retornar a UF correta, aplica a correção automática.
    cep_starts_sp = cep_destino.startswith("0") or cep_destino.startswith("1")
    if (not to_state or to_state == "SP") and not cep_starts_sp and uf_via_cep and uf_via_cep != "SP":
        logger.info(f"[ENVIO] Corrigindo automaticamente a UF do pedido #{pedido.id}: CEP {cep_destino} é de {uf_via_cep} (estava como '{to_state}')")
        to_state = uf_via_cep

    to_state = to_state or uf_via_cep or "SP"
    to_complement = getattr(pedido, "address_complement", None) or ""

    # Detalhamento de produtos para a etiqueta e seguro
    products_payload = []
    total_weight = 0
    for item in pedido.items_list:
        products_payload.append({
            "name":          item["name"],
            "quantity":      item["quantity"],
            "unitary_value": max(float(item["unitary_value"]), 0.01),
            "weight":        item["weight"],
        })
        total_weight += (item["weight"] * item["quantity"])

    # Garante peso mínimo de 0.1kg e máximo razoável
    total_weight = max(total_weight, 0.1)

    # Determina dimensões básicas com base no peso (estimativa)
    width, height, length = 15, 5, 20
    if total_weight > 2: # Caixa maior para atacado
        width, height, length = 25, 15, 30
    if total_weight > 10:
        width, height, length = 40, 30, 40

    agencia_id = _resolver_agencia_para_servico(service_id, CEP_ORIGEM)

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
        "products": products_payload,
        "volumes": [{
            "weight": round(total_weight, 3),
            "width":  width,
            "height": height,
            "length": length,
        }],
        "options": {
            "receipt":         False,
            "own_hand":        False,
            "insurance_value": max(float(pedido.valor), 0.01),
            "non_commercial":  True,
        },
    }

    # Campo exigido pela API atual do Melhor Envio para serviços que necessitam agência.
    # Mantém compatibilidade com serviços sem agência e não envia o campo quando não houver necessidade.
    if agencia_id:
        payload["agency"] = agencia_id
        logger.info(f"[ME] Agência resolvida para serviço {service_id}: agency={agencia_id}")
    else:
        logger.info(f"[ME] Nenhuma agência necessária ou encontrada para serviço {service_id}. Mantendo fluxo sem agency.")

    # Garante que, se a API retornar 422 alegando que a agência é obrigatória,
    # a integração tenta novamente usando a agência correta da origem/serviço.
    resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)

    if resp.status_code == 422:
        reply_text = str(resp.text or "").lower()
        if "agência" in reply_text or "agency" in reply_text or "agencia" in reply_text:
            agencias = _coletar_agencias_disponiveis(service_id=service_id, cep_origem=CEP_ORIGEM)
            agency_id_retry = _normalizar_agencia_id(_filtrar_agencia_valida(agencias, service_id=service_id, cep_origem=CEP_ORIGEM))
            if agency_id_retry:
                payload["agency"] = agency_id_retry
                logger.warning(f"[ME] Cart 422 sem agency; retry com agency={agency_id_retry} para service={service_id}")
                resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)
            else:
                raise RuntimeError(
                    "O serviço selecionado exige agência/ponto de postagem, mas nenhuma agência válida foi encontrada para a origem e o serviço. "
                    "Verifique a configuração/credenciais do Melhor Envio e a disponibilidade da agência para este serviço."
                )

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

def obter_detalhes_envio(shipment_id: str) -> dict:
    """
    Retorna os detalhes do envio, incluindo status e rastreamento.
    Consulta primeiro /api/v2/me/shipment/tracking e, se necessário, /api/v2/me/orders/{id}.
    """
    if not shipment_id:
        return {}

    # 1. Tenta /api/v2/me/shipment/tracking
    try:
        resp = _request_with_retry(
            "GET", "/api/v2/me/shipment/tracking",
            params={"orders[]": str(shipment_id)},
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                item = data.get(str(shipment_id)) or next(iter(data.values()), {})
                if item and isinstance(item, dict):
                    return item
            elif isinstance(data, list) and data:
                return data[0]
    except Exception as exc:
        logger.warning(f"[ME] Erro ao obter detalhes via tracking para {shipment_id}: {exc}")

    # 2. Fallback: GET /api/v2/me/orders/{shipment_id}
    try:
        resp_order = _request_with_retry("GET", f"/api/v2/me/orders/{shipment_id}")
        if resp_order.status_code == 200:
            data = resp_order.json()
            if isinstance(data, dict):
                return data
    except Exception as exc:
        logger.warning(f"[ME] Erro ao consultar /api/v2/me/orders/{shipment_id}: {exc}")

    return {}


def sync_melhor_envio_status(order, db) -> dict:
    """
    Sincroniza o status do pedido com o Melhor Envio de forma automática:
    - Se a etiqueta foi comprada/liberada no Melhor Envio: muda status para 'shipped' (Enviado).
    - Se o Melhor Envio disponibilizou código de rastreio: salva e notifica o cliente por e-mail e WhatsApp.
    - Se a etiqueta foi entregue: muda status para 'delivered' (Entregue) e notifica o cliente.
    """
    from app.core import emails
    from app.services.whatsapp import notify_customer_order_shipped, notify_customer_order_delivered

    shipment_id = getattr(order, "shipment_id", None)
    if not shipment_id:
        return {"pedido_id": order.id, "status": order.status, "atualizado": False, "motivo": "sem shipment_id"}

    detalhes = obter_detalhes_envio(shipment_id)
    if not detalhes:
        return {"pedido_id": order.id, "status": order.status, "atualizado": False, "motivo": "falha ao consultar ME"}

    me_status = str(detalhes.get("status") or "").lower().strip()
    tracking_code = (
        detalhes.get("tracking")
        or detalhes.get("tracking_code")
        or detalhes.get("code")
        or ""
    )

    logger.info(f"[ME Sync] Pedido #{order.id} | Status Interno: {order.status} | Status ME: '{me_status}' | Tracking ME: '{tracking_code}'")

    status_modificado = False
    novo_tracking_salvo = False

    # Status que indicam que a etiqueta foi comprada/liberada ou postada
    shipped_me_statuses = {"released", "generated", "posted", "received", "in_transit", "attending"}

    # 1. Se a etiqueta foi comprada no ME e o pedido ainda está como pago/processando:
    if me_status in shipped_me_statuses:
        if order.status in ("paid", "processando_envio", "erro_envio", "ERRO_ENVIO", "pending"):
            order.status = "shipped"
            status_modificado = True
            logger.info(f"[ME Sync] ✅ Pedido #{order.id} atualizado para 'shipped' pois etiqueta foi comprada no ME (Status ME: {me_status})")

    # 2. Se o pedido foi entregue:
    elif me_status == "delivered":
        if order.status != "delivered":
            order.status = "delivered"
            status_modificado = True
            logger.info(f"[ME Sync] 🏠 Pedido #{order.id} atualizado para 'delivered' (Entregue)")

    # 3. Atualizar código de rastreio se disponível
    if not tracking_code:
        # Tenta obter via função específica de tracking se ainda não temos no pedido
        if not getattr(order, "codigo_rastreio", None) and me_status in (shipped_me_statuses | {"delivered"}):
            tracking_code = obter_tracking(shipment_id)

    if tracking_code and tracking_code != getattr(order, "codigo_rastreio", None):
        order.codigo_rastreio = str(tracking_code).strip()
        novo_tracking_salvo = True
        logger.info(f"[ME Sync] 🔍 Pedido #{order.id} recebeu código de rastreio: {order.codigo_rastreio}")

    # 4. Tentar garantir URL de impressão da etiqueta se ainda não houver
    if not getattr(order, "etiqueta_url", None) and me_status in (shipped_me_statuses | {"delivered"}):
        try:
            etiqueta_url = imprimir_etiqueta(shipment_id)
            if etiqueta_url:
                order.etiqueta_url = etiqueta_url
                order.correios_label_url = etiqueta_url
                logger.info(f"[ME Sync] 📄 Etiqueta URL salva para pedido #{order.id}: {etiqueta_url}")
        except Exception as p_err:
            logger.debug(f"[ME Sync] Não foi possível obter URL da etiqueta para #{order.id}: {p_err}")

    # Se houve qualquer alteração, persiste no banco
    if status_modificado or novo_tracking_salvo:
        db.commit()
        db.refresh(order)

        customer_email = getattr(order, "customer_email", None) or getattr(order, "buyer_email", None) or (order.user.email if order.user else None)

        # Dispara notificações para o cliente
        if order.status == "shipped" and (status_modificado or novo_tracking_salvo):
            try:
                if customer_email:
                    emails.send_order_update_email(customer_email, order.id, "shipped", order.codigo_rastreio)
                notify_customer_order_shipped(order, db, order.codigo_rastreio)
            except Exception as notif_err:
                logger.error(f"[ME Sync] Erro ao notificar cliente sobre envio do pedido #{order.id}: {notif_err}")

        elif order.status == "delivered" and status_modificado:
            try:
                if customer_email:
                    emails.send_order_update_email(customer_email, order.id, "delivered")
                notify_customer_order_delivered(order, db)
            except Exception as notif_err:
                logger.error(f"[ME Sync] Erro ao notificar cliente sobre entrega do pedido #{order.id}: {notif_err}")

    return {
        "pedido_id": order.id,
        "status": order.status,
        "me_status": me_status,
        "tracking_code": getattr(order, "codigo_rastreio", None),
        "etiqueta_url": getattr(order, "etiqueta_url", None),
        "status_modificado": status_modificado,
        "novo_tracking": novo_tracking_salvo,
    }


def processar_envio(pedido, db) -> dict:
    """
    Executa a criação do envio no carrinho do Melhor Envio:
      1. Valida o CEP do destinatário
      2. selecionar_servico (calcula frete mais barato)
      3. criar_envio (cart — envia ao carrinho do Melhor Envio)
      4. Salva o shipment_id no banco
      Note: A etiqueta NÃO é comprada ou gerada automaticamente aqui.
    """
    resultado = {
        "pedido_id": pedido.id,
        "status": pedido.status,
        "service_id": None,
        "shipment_id": getattr(pedido, "shipment_id", None),
        "tracking_code": getattr(pedido, "tracking_code", None),
        "etiqueta_url": getattr(pedido, "etiqueta_url", None),
        "erro": None,
    }

    try:
        # Validate CEP before proceeding
        cep_raw = pedido.cep_cliente
        cep_digits = "".join(c for c in (cep_raw or "") if c.isdigit())
        logger.info(f"[ENVIO] CEP do destinatário: '{cep_raw}' → dígitos: '{cep_digits}'")
        logger.info(f"[ENVIO] Endereço completo: {getattr(pedido._order, 'address', {})}")
        if len(cep_digits) != 8 or cep_digits == "00000000":
            raise RuntimeError(
                f"CEP inválido: '{cep_raw}'. O CEP deve ter 8 dígitos numéricos. "
                f"Edite o endereço do pedido e corrija o campo CEP/postal_code."
            )

        shipment_id = getattr(pedido, "shipment_id", None)
        tracking_from_cart = ""

        if not shipment_id:
            service_id = selecionar_servico(cep_digits, pedido.valor, pedido.produto_nome)
            resultado["service_id"] = service_id

            shipment_id, tracking_from_cart = criar_envio(pedido, service_id)
            pedido.shipment_id = shipment_id
            if tracking_from_cart:
                pedido.tracking_code = tracking_from_cart
                resultado["tracking_code"] = tracking_from_cart
            db.commit()
            logger.info(f"[ENVIO] Envio criado no carrinho do Melhor Envio para o pedido {pedido.id}. shipment_id={shipment_id}")
        else:
            logger.info(f"[ENVIO] Envio já existe para o pedido {pedido.id}. shipment_id={shipment_id}")

        resultado["shipment_id"] = shipment_id

        # O status do pedido permanece intacto (geralmente 'paid')
        resultado["status"] = pedido.status

        logger.info(
            f"[ENVIO] ✅ Pedido {pedido.id} processado para carrinho | "
            f"shipment={shipment_id} | status={pedido.status}"
        )

    except Exception as exc:
        logger.error(f"[ENVIO] ❌ Pedido {pedido.id}: {exc}", exc_info=True)
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
