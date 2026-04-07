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

    # ------------------------------------------------------------------
    # Campos do destinatário (extraídos do JSON address do pedido)
    # ------------------------------------------------------------------
    @property
    def customer_name(self) -> str:
        return (
            getattr(self._order, "customer_name", None)
            or (self._order.address or {}).get("name")
            or (self._order.address or {}).get("full_name")
            or "Cliente"
        )

    @property
    def customer_phone(self) -> str:
        raw = (
            getattr(self._order, "customer_phone", None)
            or (self._order.address or {}).get("phone")
            or "11999999999"
        )
        return str(raw).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    @property
    def customer_email(self) -> str:
        return (
            getattr(self._order, "customer_email", None)
            or (self._order.address or {}).get("email")
            or "cliente@email.com"
        )

    @property
    def customer_cpf(self) -> str:
        raw = (
            getattr(self._order, "customer_cpf", None)
            or (self._order.address or {}).get("cpf")
            or (self._order.address or {}).get("document")
        )
        if raw:
            return str(raw).replace(".", "").replace("-", "").replace("/", "").strip()
        return ""

    @property
    def address_street(self) -> str:
        return (self._order.address or {}).get("street") \
            or (self._order.address or {}).get("logradouro") \
            or "Endereço não informado"

    @property
    def address_number(self) -> str:
        return str((self._order.address or {}).get("number") or "S/N")

    @property
    def address_complement(self) -> str:
        return (self._order.address or {}).get("complement") or ""

    @property
    def address_district(self) -> str:
        return (self._order.address or {}).get("neighborhood") \
            or (self._order.address or {}).get("district") \
            or "Bairro"

    @property
    def address_city(self) -> str:
        return (self._order.address or {}).get("city") or "Cidade"

    @property
    def address_state(self) -> str:
        return (self._order.address or {}).get("state") \
            or (self._order.address or {}).get("state_abbr") \
            or "SP"

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
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "customer_email": self.customer_email,
            "address_street": self.address_street,
            "address_city": self.address_city,
            "address_state": self.address_state,
            "shipment_id": self.shipment_id,
            "tracking_code": self.tracking_code,
            "etiqueta_url": self.etiqueta_url,
        }
