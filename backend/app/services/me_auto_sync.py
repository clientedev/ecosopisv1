"""
Sincronização automática com o Melhor Envio (somente LEITURA do status).

A compra da etiqueta continua 100% manual no painel do Melhor Envio. Depois que você compra:
  - o pedido passa para "Enviado" (shipped), com código de rastreio e URL da etiqueta;
  - quando a transportadora entrega, passa para "Entregue" (delivered);
  - o cliente é avisado por e-mail e WhatsApp a cada mudança (mesma lógica do botão "Sincronizar").

Não depende do webhook do Melhor Envio estar cadastrado: consulta a API periodicamente.
Esta rotina NUNCA cria, compra ou cancela etiquetas.
"""
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

INTERVALO_SEGUNDOS = int(os.getenv("ME_AUTO_SYNC_INTERVAL", "600"))   # 10 min
ATRASO_INICIAL = int(os.getenv("ME_AUTO_SYNC_DELAY", "120"))          # 2 min após subir
JANELA_DIAS = int(os.getenv("ME_AUTO_SYNC_DAYS", "45"))               # só pedidos recentes
ATIVO = os.getenv("ME_AUTO_SYNC", "1") not in ("0", "false", "False")

_started = False
_lock = threading.Lock()


def _pode_rodar_nesta_instancia(db) -> bool:
    """Evita rodar em duplicidade quando há mais de um worker/instância (Postgres advisory lock)."""
    try:
        if db.bind.dialect.name != "postgresql":
            return True
        from sqlalchemy import text
        return bool(db.execute(text("SELECT pg_try_advisory_lock(8731001)")).scalar())
    except Exception:
        return True


def _liberar_lock(db):
    try:
        if db.bind.dialect.name == "postgresql":
            from sqlalchemy import text
            db.execute(text("SELECT pg_advisory_unlock(8731001)"))
            db.commit()
    except Exception:
        pass


def sincronizar_pedidos_ativos() -> dict:
    from app.core.database import SessionLocal
    from app.models import models
    from app.services.melhorenvio_service import sync_melhor_envio_status

    db = SessionLocal()
    resumo = {"consultados": 0, "atualizados": 0, "erros": 0}
    try:
        if not _pode_rodar_nesta_instancia(db):
            return {**resumo, "pulado": "outra instância está sincronizando"}
        desde = datetime.now(timezone.utc) - timedelta(days=JANELA_DIAS)
        pedidos = (
            db.query(models.Order)
            .filter(
                models.Order.shipment_id.isnot(None),
                models.Order.status.in_(["paid", "processando_envio", "erro_envio", "ERRO_ENVIO", "shipped"]),
                models.Order.created_at >= desde,
            )
            .all()
        )
        for o in pedidos:
            sid = str(o.shipment_id or "")
            if not sid or sid.startswith(("sim-", "mock-")):
                continue
            resumo["consultados"] += 1
            antes = (o.status, o.codigo_rastreio)
            try:
                sync_melhor_envio_status(o, db)
                if (o.status, o.codigo_rastreio) != antes:
                    resumo["atualizados"] += 1
            except Exception as exc:
                resumo["erros"] += 1
                logger.error(f"[ME-AUTO] Falha ao sincronizar pedido #{o.id}: {exc}")
                try:
                    db.rollback()
                except Exception:
                    pass
    except Exception as exc:
        logger.error(f"[ME-AUTO] Erro no ciclo de sincronização: {exc}", exc_info=True)
    finally:
        _liberar_lock(db)
        db.close()
    return resumo


def _loop():
    time.sleep(ATRASO_INICIAL)
    while True:
        try:
            r = sincronizar_pedidos_ativos()
            if r.get("atualizados") or r.get("erros"):
                logger.info(f"[ME-AUTO] Ciclo concluído: {r}")
        except Exception as exc:  # nunca derruba o thread
            logger.error(f"[ME-AUTO] {exc}")
        time.sleep(INTERVALO_SEGUNDOS)


def iniciar():
    """Inicia o thread em segundo plano (uma vez por processo)."""
    global _started
    if not ATIVO:
        logger.info("[ME-AUTO] Sincronização automática desativada (ME_AUTO_SYNC=0).")
        return
    with _lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_loop, name="me-auto-sync", daemon=True).start()
    logger.info(f"[ME-AUTO] Sincronização automática ativa: a cada {INTERVALO_SEGUNDOS}s (somente leitura).")
