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
from typing import Optional, Tuple, Dict, Any, List, Union
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
STORE_ADDRESS  = os.getenv("STORE_ADDRESS", "Rua Doutor João Toniolo")
STORE_NUMBER   = os.getenv("STORE_NUMBER", "63")
STORE_DISTRICT = os.getenv("STORE_DISTRICT", "Jardim São José")
STORE_CITY     = os.getenv("STORE_CITY", "São Paulo")
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
# Mapeamento de Serviços e Agências (Jadlog, Azul, etc.)
# ---------------------------------------------------------------------------

SERVICE_TO_COMPANY = {
    1: 1,   # Correios PAC
    2: 1,   # Correios SEDEX
    17: 1,  # Correios Mini Envios
    3: 2,   # Jadlog .Package
    4: 2,   # Jadlog .Com
    27: 2,  # Jadlog .Package Centralizado / Pickup
    12: 6,  # LATAM Cargo éFácil
    15: 9,  # Azul Cargo Expresso
    16: 9,  # Azul Cargo e-commerce
    22: 12, # Buslog Rodoviário
    31: 14, # Loggi Express
    32: 14, # Loggi Coleta
    33: 15, # J&T Standard
    34: 14, # Loggi Ponto
    35: 8,  # Total Express Standard
}

_AGENCY_CACHE: Dict[str, int] = {}


def obter_agencia(company_id: int = 2, state: str = STORE_STATE, city: str = STORE_CITY) -> Optional[int]:
    """
    Busca o ID da agência/ponto de coleta no Melhor Envio para transportadoras
    que exigem agência de postagem (como Jadlog, Azul Cargo, etc.).
    """
    env_agency = os.getenv("MELHORENVIO_AGENCY_ID", "").strip()
    if env_agency and env_agency.isdigit():
        return int(env_agency)

    cache_key = f"{company_id}:{state}:{city}".lower().strip()
    if cache_key in _AGENCY_CACHE:
        return _AGENCY_CACHE[cache_key]

    # Tentativas em cascata:
    # 1. Cidade + Estado da loja
    # 2. Somente Estado da loja
    # 3. Somente Empresa
    attempts = [
        {"company": company_id, "state": state, "city": city},
        {"company": company_id, "state": state},
        {"company": company_id},
    ]

    for params in attempts:
        try:
            logger.info(f"[ME] Consultando agências de postagem com parâmetros: {params}")
            resp = _request_with_retry("GET", "/api/v2/me/shipment/agencies", params=params)
            if resp.status_code == 200:
                data = resp.json()
                agencies = data if isinstance(data, list) else data.get("data", [])
                if isinstance(agencies, list) and len(agencies) > 0:
                    # Dá preferência a agência com status "active" ou a primeira retornada
                    active = [a for a in agencies if a.get("status") == "active"] or agencies
                    agency_id = active[0].get("id")
                    agency_name = active[0].get("name") or active[0].get("company_name") or "Agência"
                    if agency_id:
                        logger.info(f"[ME] Agência encontrada: ID {agency_id} ({agency_name})")
                        _AGENCY_CACHE[cache_key] = int(agency_id)
                        return int(agency_id)
        except Exception as err:
            logger.warning(f"[ME] Falha ao consultar agências com {params}: {err}")

    logger.warning(f"[ME] Nenhuma agência encontrada para company_id={company_id}, state={state}, city={city}")
    return None


def servico_exige_agencia(service_id: int, company_id: Optional[int] = None, company_name: str = "") -> bool:
    """Retorna True se o serviço exigir agência obrigatória no payload do Melhor Envio."""
    # Correios NUNCA exige agência
    if company_id == 1 or "correios" in company_name.lower() or service_id in (1, 2, 17):
        return False
    # Jadlog e outras transportadoras privadas exigem agência
    return True


# ---------------------------------------------------------------------------
# 1. Selecionar serviço
# ---------------------------------------------------------------------------

def selecionar_servico(
    cep_destino: str,
    valor: float,
    produto_nome: str = "Produto",
    shipping_method: str = "",
) -> Tuple[int, Optional[int]]:
    """
    Calcula opções de frete e seleciona o melhor serviço viável:
      1. Se o pedido tem shipping_method (ex: 'PAC', 'SEDEX', 'Jadlog', etc.), prioriza o método escolhido.
      2. Caso contrário, escolhe a opção mais barata que seja viável (ou seja, se exigir agência, que uma agência exista).
      3. Se o serviço selecionado exigir agência, retorna (service_id, agency_id).
      4. Se nenhuma agência estiver disponível para o serviço privado, faz fallback seguro para Correios PAC ou SEDEX.
    Retorna tupla: (service_id, agency_id)
    """
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

    def _avaliar_opcao(opt: dict) -> Tuple[bool, Optional[int]]:
        sid = int(opt["id"])
        comp = opt.get("company") or {}
        cid = comp.get("id") or SERVICE_TO_COMPANY.get(sid, 1)
        cname = str(comp.get("name") or "")

        if not servico_exige_agencia(sid, cid, cname):
            return True, None

        ag_id = obter_agencia(company_id=cid, state=STORE_STATE, city=STORE_CITY)
        if ag_id:
            return True, ag_id
        return False, None

    sm_clean = (shipping_method or "").strip().lower()
    selected_option = None
    selected_agency_id = None

    # 1. Se o cliente selecionou um método específico (ex: PAC, SEDEX, Jadlog .Package)
    is_generic_or_free = (
        sm_clean in (
            "melhor envio", "fixo", "padrão", "padrao", "frete",
            "frete grátis", "frete gratis", "grátis", "gratis", "free", "free shipping"
        )
        or "grátis" in sm_clean
        or "gratis" in sm_clean
        or "free" in sm_clean
    )
    if sm_clean and not is_generic_or_free:
        for opt in valid_options:
            opt_name = str(opt.get("name") or "").lower()
            opt_comp = str((opt.get("company") or {}).get("name") or "").lower()
            full_str = f"{opt_name} {opt_comp}"

            if sm_clean in full_str or sm_clean == str(opt.get("id")):
                viavel, ag_id = _avaliar_opcao(opt)
                if viavel:
                    selected_option = opt
                    selected_agency_id = ag_id
                    logger.info(
                        f"[ME] Serviço correspondente ao escolhido pelo cliente (#{shipping_method}): "
                        f"{opt.get('name')} (R$ {opt.get('price')}) agência={ag_id}"
                    )
                    break

    # 2. Se não bateu com nenhum específico, busca o mais barato viável
    if not selected_option:
        sorted_by_price = sorted(valid_options, key=lambda o: float(o["price"]))
        for opt in sorted_by_price:
            viavel, ag_id = _avaliar_opcao(opt)
            if viavel:
                selected_option = opt
                selected_agency_id = ag_id
                logger.info(
                    f"[ME] Serviço mais barato viável: {opt.get('name')} (R$ {opt.get('price')}) "
                    f"id={opt.get('id')} agência={ag_id}"
                )
                break

    # 3. Fallback: se nenhum privado tiver agência, garante Correios (PAC/SEDEX)
    if not selected_option:
        correios_options = [
            o for o in valid_options 
            if not servico_exige_agencia(int(o["id"]), (o.get("company") or {}).get("id"), str((o.get("company") or {}).get("name") or ""))
        ]
        if correios_options:
            selected_option = min(correios_options, key=lambda o: float(o["price"]))
            selected_agency_id = None
            logger.info(f"[ME] Fallback Correios sem agência: {selected_option.get('name')} id={selected_option.get('id')}")
        else:
            selected_option = valid_options[0]
            selected_agency_id = None

    return int(selected_option["id"]), selected_agency_id


# ---------------------------------------------------------------------------
# 2. Criar envio no carrinho
# ---------------------------------------------------------------------------

def criar_envio(
    pedido,
    service_id: int,
    agency_id: Optional[int] = None,
    package_dimensions: Optional[dict] = None
) -> tuple[str, str]:
    """POST /api/v2/me/cart — Retorna (shipment_id, tracking_code_inicial)."""
    service_id = int(service_id)

    # Se agency_id não foi informado mas o serviço exige agência (ex: Jadlog 3 ou 4),
    # tenta resolver a agência automaticamente.
    if agency_id is None and servico_exige_agencia(service_id):
        comp_id = SERVICE_TO_COMPANY.get(service_id, 2)
        agency_id = obter_agencia(company_id=comp_id, state=STORE_STATE, city=STORE_CITY)
        if not agency_id:
            # Se absolutamente nenhuma agência for encontrada para Jadlog/privada,
            # faz fallback para Correios PAC (id=1) para não tomar erro 422
            logger.warning(
                f"[ME] Serviço {service_id} exige agência mas nenhuma foi localizada. "
                f"Alterando serviço para Correios PAC (id=1) para evitar erro 422."
            )
            service_id = 1

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
    
    # Determina dimensões básicas com base no peso (estimativa padrão)
    width, height, length = 16, 12, 20
    if total_weight > 2: # Caixa maior para atacado
        width, height, length = 25, 15, 30
    if total_weight > 10:
        width, height, length = 40, 30, 40

    # Dimensões e peso customizados pelo administrador (payload ou pedido)
    custom_w = (package_dimensions or {}).get("width") or getattr(pedido, "package_width", None)
    custom_h = (package_dimensions or {}).get("height") or getattr(pedido, "package_height", None)
    custom_l = (package_dimensions or {}).get("length") or getattr(pedido, "package_length", None)
    custom_weight = (package_dimensions or {}).get("weight") or getattr(pedido, "package_weight", None)

    if custom_w and float(custom_w) > 0:
        width = float(custom_w)
    if custom_h and float(custom_h) > 0:
        height = float(custom_h)
    if custom_l and float(custom_l) > 0:
        length = float(custom_l)
    if custom_weight and float(custom_weight) > 0:
        total_weight = float(custom_weight)

    logger.info(f"[ME] Embalagem final: {length}x{width}x{height}cm, peso: {total_weight}kg para pedido #{pedido.id}")

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
            "weight": round(float(total_weight), 3),
            "width":  round(float(width), 1),
            "height": round(float(height), 1),
            "length": round(float(length), 1),
        }],
        "options": {
            "receipt":         False,
            "own_hand":        False,
            "insurance_value": max(float(pedido.valor), 0.01),
            "non_commercial":  True,
        },
    }

    if agency_id:
        payload["agency"] = int(agency_id)
        logger.info(f"[ME] Agência informada no carrinho: agency={agency_id}")

    resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)

    if resp.status_code not in (200, 201):
        err_lower = resp.text.lower()
        if resp.status_code == 422 and ("agência" in err_lower or "agencia" in err_lower):
            logger.warning(f"[ME] Erro de agência obrigatória para serviço {service_id}. Buscando agência automática...")
            comp_id = SERVICE_TO_COMPANY.get(service_id, 2)
            fallback_agency = obter_agencia(company_id=comp_id, state="SP", city="São Paulo")
            if fallback_agency:
                payload["agency"] = int(fallback_agency)
                resp = _request_with_retry("POST", "/api/v2/me/cart", json=payload)
            if resp.status_code not in (200, 201):
                logger.warning(f"[ME] Falha com agência. Aplicando fallback de segurança para Correios SEDEX (id=2)...")
                payload["service"] = 2
                payload.pop("agency", None)
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



def processar_envio(
    pedido,
    db,
    service_id_override: Optional[int] = None,
    package_dimensions: Optional[dict] = None
) -> dict:
    """
    Executa a criação do envio no carrinho do Melhor Envio:
      1. Valida o CEP do destinatário
      2. Seleciona o serviço (usando service_id_override se fornecido, ou calculando)
      3. criar_envio (cart — envia ao carrinho do Melhor Envio com dimensões/peso)
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
            shipping_method = getattr(pedido, "shipping_method", "") or ""
            target_service_id = service_id_override or getattr(pedido, "shipping_service_id", None)
            
            if target_service_id:
                service_id = int(target_service_id)
                agency_id = None
                if servico_exige_agencia(service_id):
                    comp_id = SERVICE_TO_COMPANY.get(service_id, 2)
                    agency_id = obter_agencia(company_id=comp_id, state=STORE_STATE, city=STORE_CITY)
                logger.info(f"[ENVIO] Usando transportadora/serviço explicitamente selecionado: ID {service_id}")
            else:
                service_id, agency_id = selecionar_servico(
                    cep_digits, pedido.valor, pedido.produto_nome, shipping_method=shipping_method
                )
            resultado["service_id"] = service_id

            shipment_id, tracking_from_cart = criar_envio(
                pedido,
                service_id,
                agency_id=agency_id,
                package_dimensions=package_dimensions
            )
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
            res = selecionar_servico(cep_destino, 0)
            sid = res[0] if isinstance(res, tuple) else res
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
            shipping_method="",
        )
        try:
            agency_id = None
            if shipping_service_id:
                service_id = int(shipping_service_id)
            else:
                res = selecionar_servico(pedido_ns.cep_cliente, pedido_ns.valor)
                if isinstance(res, tuple):
                    service_id, agency_id = res
                else:
                    service_id = res
            shipment_id, tracking_from_cart = criar_envio(pedido_ns, service_id, agency_id=agency_id)
            return {
                "melhorenvio_id": shipment_id,
                "tracking_code": tracking_from_cart,
                "etiqueta_url": None,
                "generated": False,
                "in_cart": True,
            }
        except Exception as exc:
            logger.error(f"[MelhorEnvioV2Service] Erro: {exc}", exc_info=True)
            return None
