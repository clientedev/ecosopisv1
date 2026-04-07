"""
Adaptador Pedido — compatibiliza Order (modelo principal) com o
serviço de envio do Melhor Envio.

Uso:
    from app.models.pedido import Pedido, StatusPedido
    p = Pedido.from_order(order)
    p.cep_cliente  # CEP do destinatário
    p.valor        # valor total do pedido
"""

from enum import Enum
from app.models.models import Order


class StatusPedido(str, Enum):
    PAGO = "paid"
    PROCESSANDO_ENVIO = "PROCESSANDO_ENVIO"
    ENVIADO = "ENVIADO"
    ERRO_ENVIO = "ERRO_ENVIO"
    ENTREGUE = "delivered"
    CANCELADO = "cancelled"


class Pedido:
    """
    Wrapper leve sobre Order que expõe os campos necessários
    para o fluxo do Melhor Envio.
    """

    def __init__(self, order: Order):
        self._order = order

    # Campos obrigatórios para o serviço de envio
    @property
    def id(self) -> int:
        return self._order.id

    @property
    def valor(self) -> float:
        return float(self._order.total or 0)

    @property
    def produto_nome(self) -> str:
        # Tenta extrair o nome do primeiro item do pedido
        items = self._order.items or []
        if items and isinstance(items, list) and isinstance(items[0], dict):
            return items[0].get("name") or items[0].get("product_name") or "Produto ECOSOPIS"
        return "Produto ECOSOPIS"

    @property
    def cep_cliente(self) -> str:
        address = self._order.address or {}
        cep = (
            address.get("zip")
            or address.get("cep")
            or address.get("postal_code")
            or "00000000"
        )
        return str(cep).replace("-", "").strip()

    # Campos de rastreio / envio — lidos/escritos no Order diretamente
    @property
    def status(self) -> str:
        return self._order.status

    @status.setter
    def status(self, value: str):
        self._order.status = value

    @property
    def shipment_id(self) -> str:
        return getattr(self._order, "shipment_id", None)

    @shipment_id.setter
    def shipment_id(self, value: str):
        self._order.shipment_id = value

    @property
    def tracking_code(self) -> str:
        return getattr(self._order, "codigo_rastreio", None)

    @tracking_code.setter
    def tracking_code(self, value: str):
        self._order.codigo_rastreio = value

    @property
    def etiqueta_url(self) -> str:
        return getattr(self._order, "etiqueta_url", None) or getattr(self._order, "correios_label_url", None)

    @etiqueta_url.setter
    def etiqueta_url(self, value: str):
        # Grava em ambos os campos para retrocompatibilidade
        if hasattr(self._order, "etiqueta_url"):
            self._order.etiqueta_url = value
        self._order.correios_label_url = value

    @classmethod
    def from_order(cls, order: Order) -> "Pedido":
        return cls(order)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "status": self.status,
            "valor": self.valor,
            "produto_nome": self.produto_nome,
            "cep_cliente": self.cep_cliente,
            "shipment_id": self.shipment_id,
            "tracking_code": self.tracking_code,
            "etiqueta_url": self.etiqueta_url,
        }
