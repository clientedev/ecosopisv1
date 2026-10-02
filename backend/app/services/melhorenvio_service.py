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
        
        # LOG DEBUG: mostra exatamente o que a API retornou
        logger.info(f"[ME] Resposta de agencies (tipo: {type(data).__name__}): {str(data)[:500]}")
        
        if isinstance(data, list):
            logger.info(f"[ME] Agências retornadas (lista): {len(data)} item(ns)")
            return data
        if isinstance(data, dict):
            logger.info(f"[ME] Agências retornadas (dict): keys={list(data.keys())}")
            for key in ("data", "agencies", "result", "results"):
                if isinstance(data.get(key), list):
                    logger.info(f"[ME] Encontrado '{key}' com {len(data[key])} item(ns)")
                    return data[key]
            logger.info(f"[ME] Nenhuma chave padrão encontrada. Retornando como lista única.")
            return [data]
        logger.warning(f"[ME] Formato inesperado na resposta de agencies: {type(data)}")
        return []
    except Exception as exc:
        logger.warning(f"[ME] Falha ao consultar agências: {exc}")
        return []


def _normalizar_agencia_id(raw_agencia) -> str:
    if raw_agencia is None:
        return ""
    if isinstance(raw_agencia, dict):
        # LOG DEBUG
        logger.info(f"[ME] Normalizando agência (dict): keys={list(raw_agencia.keys())}")
        for key in ("id", "agency_id", "agencyId"):
            if key in raw_agencia:
                valor = str(raw_agencia[key])
                logger.info(f"[ME] Agência ID encontrada em '{key}': {valor}")
                return valor
        logger.warning(f"[ME] Nenhuma chave de ID encontrada na agência: {raw_agencia}")
        return ""
    if isinstance(raw_agencia, (int, float, str)):
        return str(raw_agencia)
    return ""


def _filtrar_agencia_valida(agencias: list, service_id: int = None, cep_origem: str = CEP_ORIGEM):
    """Retorna a agência mais adequada para o serviço/origem. Se houver mais de uma, prioriza a melhor compatível."""
    if not agencias:
        logger.warning(f"[ME] Lista de agências vazia")
        return None

    logger.info(f"[ME] Filtrando {len(agencias)} agência(s) para service_id={service_id}, cep_origem={cep_origem}")
    
    service_id = int(service_id) if service_id is not None else None
    cep_origem = str(cep_origem or "").replace("-", "").strip()

    def agencia_apta(item) -> bool:
        if not isinstance(item, dict):
            logger.warning(f"[ME] Item não é dict: {type(item)}")
            return False
        
        agency_id = _normalizar_agencia_id(item)
        if not agency_id:
            logger.warning(f"[ME] Item sem ID válido: {item}")
            return False

        # Filtra por serviço quando o retorno expõe `service` ou `services`
        service_list = item.get("services") or item.get("service") or item.get("service_id") or item.get("service_ids")
        
        logger.info(f"[ME] Agência {agency_id}: service_list={service_list}")
        
        if service_id is not None:
            if isinstance(service_list, list):
                if str(service_id) not in [str(v) for v in service_list]:
                    logger.info(f"[ME] Agência {agency_id} não oferece serviço {service_id}")
                    return False
            elif isinstance(service_list, dict):
                if str(service_id) not in [str(k) for k in service_list.keys()]:
                    logger.info(f"[ME] Agência {agency_id} não oferece serviço {service_id} (dict keys)")
                    return False
            elif isinstance(service_list, (int, float, str)):
                if str(service_id) != str(service_list):
                    logger.info(f"[ME] Agência {agency_id} oferece serviço {service_list}, não {service_id}")
                    return False

        logger.info(f"[ME] Agência {agency_id} é VÁLIDA para serviço {service_id}")
        return True

    validas = [item for item in agencias if agencia_apta(item)]
    
    if not validas:
        logger.warning(f"[ME] Nenhuma agência válida encontrada após filtragem")
        return None

    logger.info(f"[ME] {len(validas)} agência(s) válida(s) encontrada(s)")
    
    # Prioriza agências que incluem o id em campos mais explícitos
    for item in validas:
        if isinstance(item, dict):
            if item.get("is_active") is False:
                continue
            if item.get("available") is False:
                continue
            logger.info(f"[ME] Agência selecionada: {item}")
            return item
    
    logger.info(f"[ME] Selecionando primeira agência válida: {validas[0]}")
    return validas[0]


def _resolver_agencia_para_servico(service_id: int, cep_origem: str = CEP_ORIGEM):
    """Resolve agency_id válido para a origem e o serviço atual; retorna None se não for obrigatório."""
    logger.info(f"[ME] Resolvendo agência para serviço {service_id}, origem {cep_origem}")
    agencias = _coletar_agencias_disponiveis(service_id=service_id, cep_origem=cep_origem)
    agencia = _filtrar_agencia_valida(agencias, service_id=service_id, cep_origem=cep_origem)
    if agencia is None:
        logger.warning(f"[ME] Nenhuma agência resolvida para serviço {service_id}")
        return None
    resultado = _normalizar_agencia_id(agencia)
    logger.info(f"[ME] Agência resolvida para serviço {service_id}: {resultado}")
    return resultado
