"""
Rotas de envio — Melhor Envio
------------------------------
POST /envio/{pedido_id}        → Dispara envio manual em background
GET  /envio/status/{pedido_id} → Retorna status completo do pedido
"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Order
from app.models.pedido import Pedido, StatusPedido
from app.services import melhorenvio_service as me_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/envio", tags=["envio"])


def _executar_envio_bg(order_id: int):
    """
    Função executada em background: obtém uma sessão própria e processa o envio.
    """
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            logger.error(f"[BG] Pedido {order_id} não encontrado.")
            return
        pedido = Pedido.from_order(order)
        resultado = me_service.processar_envio(pedido, db)
        logger.info(f"[BG] Resultado envio pedido {order_id}: {resultado}")
    except Exception as exc:
        logger.error(f"[BG] Erro inesperado no envio do pedido {order_id}: {exc}", exc_info=True)
    finally:
        db.close()


@router.post("/{pedido_id}", summary="Disparar envio de um pedido já pago")
async def disparar_envio(
    pedido_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Recebe um pedido já pago e inicia o fluxo completo de envio via Melhor Envio
    em background (não bloqueia a requisição).

    Fluxo executado assincronamente:
      1. Status → PROCESSANDO_ENVIO
      2. Criar envio no carrinho do Melhor Envio
      3. Selecionar serviço mais barato
      4. Comprar etiqueta
      5. Gerar etiqueta (PDF)
      6. Salvar tracking_code e etiqueta_url
      7. Status → ENVIADO  (ou ERRO_ENVIO em caso de falha)
    """
    order = db.query(Order).filter(Order.id == pedido_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")

    if order.status not in ("paid", "PAGO", StatusPedido.PAGO.value):
        raise HTTPException(
            status_code=400,
            detail=f"Pedido não está com status 'paid'. Status atual: {order.status}",
        )

    background_tasks.add_task(_executar_envio_bg, pedido_id)

    return {
        "mensagem": "Envio iniciado em segundo plano.",
        "pedido_id": pedido_id,
        "status_atual": order.status,
    }


@router.get("/status/{pedido_id}", summary="Consultar status completo do envio")
async def status_envio(
    pedido_id: int,
    db: Session = Depends(get_db),
):
    """
    Retorna o status completo do pedido, incluindo shipment_id,
    código de rastreio e URL da etiqueta.
    """
    order = db.query(Order).filter(Order.id == pedido_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")

    pedido = Pedido.from_order(order)
    return {
        "pedido_id": pedido_id,
        "status": order.status,
        "shipment_id": pedido.shipment_id,
        "tracking_code": pedido.tracking_code,
        "etiqueta_url": pedido.etiqueta_url,
        "valor": pedido.valor,
        "cep_cliente": pedido.cep_cliente,
    }
