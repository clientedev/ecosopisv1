import os
import requests
import re
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.models import models

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000").rstrip("/")
JULIA_WHATSAPP_NUMBER = os.getenv("JULIA_WHATSAPP_NUMBER", "11951559212")

def get_whatsapp_endpoints() -> List[str]:
    """Retorna lista priorizada de endpoints para comunicação com a API do WhatsApp."""
    endpoints = []
    if FRONTEND_URL:
        endpoints.append(f"{FRONTEND_URL}/api/whatsapp/send")
    
    # Fallbacks comuns para ambientes locais e de produção
    defaults = [
        "http://localhost:3000/api/whatsapp/send",
        "http://127.0.0.1:3000/api/whatsapp/send",
        "http://localhost:5000/api/whatsapp/send",
        "http://127.0.0.1:5000/api/whatsapp/send",
        "https://ecosopis.com.br/api/whatsapp/send",
        "https://www.ecosopis.com.br/api/whatsapp/send",
    ]
    for url in defaults:
        if url not in endpoints:
            endpoints.append(url)
    return endpoints

def format_phone(phone: str) -> str:
    """Sanitiza o telefone mantendo apenas números com DDI 55."""
    clean = re.sub(r"\D", "", phone or "")
    if len(clean) in [10, 11]:
        clean = "55" + clean
    return clean

def render_template(template_str: str, context: Dict[str, Any]) -> str:
    """Substitui variáveis {nome} no template com os dados do contexto."""
    rendered = template_str
    for key, value in context.items():
        pattern = re.compile(rf"\{{{key}\}}", re.IGNORECASE)
        rendered = pattern.sub(str(value if value is not None else ""), rendered)
    return rendered

def send_whatsapp_notification(
    phone: str,
    message: str,
    trigger_type: str = "manual",
    recipient_name: str = ""
) -> bool:
    """
    Função auxiliar reutilizável para disparar notificações via WhatsApp.
    Envia requisição para a API local ou remota do WhatsApp Baileys com fallback de conexão.
    """
    clean_phone = format_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        logger.warning(f"[WhatsApp] Telefone inválido: {phone}")
        return False

    payload = {
        "to": clean_phone,
        "message": message,
        "triggerType": trigger_type,
        "recipientName": recipient_name
    }

    endpoints = get_whatsapp_endpoints()
    for endpoint in endpoints:
        try:
            res = requests.post(endpoint, json=payload, timeout=8)
            if res.status_code == 200:
                logger.info(f"[WhatsApp] Mensagem ({trigger_type}) enviada com sucesso para {clean_phone} via {endpoint}!")
                return True
            else:
                logger.debug(f"[WhatsApp] Endpoint {endpoint} retornou status {res.status_code}: {res.text[:150]}")
        except Exception as e:
            logger.debug(f"[WhatsApp] Falha ao conectar em {endpoint}: {e}")

    logger.warning(f"[WhatsApp] Não foi possível entregar mensagem para {clean_phone} em nenhum dos endpoints.")
    return False

def trigger_whatsapp_event(
    trigger_type: str,
    phone: str,
    context: Dict[str, Any],
    db: Session,
    recipient_name: str = ""
) -> bool:
    """
    Busca o template ativo correspondente ao evento no banco de dados,
    injeta as variáveis de personalização e dispara para o cliente.
    """
    try:
        tpl = db.query(models.WhatsAppTemplate).filter(
            models.WhatsAppTemplate.trigger_type == trigger_type,
            models.WhatsAppTemplate.is_enabled == True
        ).first()

        if not tpl:
            logger.info(f"[WhatsApp] Nenhum template ativo para o gatilho '{trigger_type}'. Disparo ignorado.")
            return False

        message = render_template(tpl.message_template, context)
        return send_whatsapp_notification(
            phone=phone,
            message=message,
            trigger_type=trigger_type,
            recipient_name=recipient_name or str(context.get("cliente", ""))
        )
    except Exception as err:
        logger.error(f"[WhatsApp] Erro ao disparar gatilho {trigger_type}: {err}")
        return False

def notify_julia_new_order(order: models.Order, db: Session) -> bool:
    """
    Dispara notificação de nova venda confirmada para o WhatsApp da Júlia (11951559212).
    Inclui detalhes completos da compra, cliente, produtos, valores e endereço de entrega.
    """
    try:
        buyer_name = order.buyer_name or order.customer_name or (order.user.full_name if order.user else "Cliente")
        buyer_phone = order.customer_phone or (order.user.phone if order.user else "Não informado")
        buyer_cpf = order.customer_cpf or "Não informado"
        buyer_email = order.buyer_email or order.customer_email or (order.user.email if order.user else "Não informado")
        
        # Formata itens comprados
        items_list = order.items or []
        if not items_list and hasattr(order, "order_items") and order.order_items:
            items_list = [
                {
                    "name": it.product.name if it.product else getattr(it, "product_name", "Produto"),
                    "quantity": it.quantity,
                    "price": it.price
                }
                for it in order.order_items
            ]
        
        items_lines = []
        for it in items_list:
            p_name = it.get("name") or it.get("product_name") or "Produto Ecosopis"
            qty = it.get("quantity") or 1
            price = it.get("price") or 0.0
            items_lines.append(f"  • {qty}x {p_name} (R$ {price:.2f})")
            
        items_text = "\n".join(items_lines) if items_lines else "  • Cosméticos Naturais Ecosopis"

        # Formata endereço de entrega
        addr = order.address or {}
        street = addr.get("street") or addr.get("logradouro") or "Endereço não informado"
        number = addr.get("number") or "S/N"
        complement = f" - {addr.get('complement')}" if addr.get("complement") else ""
        neighborhood = addr.get("neighborhood") or addr.get("bairro") or ""
        city = addr.get("city") or addr.get("localidade") or ""
        state = addr.get("state") or addr.get("uf") or ""
        cep = addr.get("postal_code") or addr.get("cep") or ""
        address_text = f"{street}, {number}{complement}\n{neighborhood} — {city}/{state}\nCEP: {cep}"

        # Informações de pagamento
        pay_method = order.payment_method or "mercadopago"
        pay_method_label = "Mercado Pago (Confirmado ✅)" if pay_method == "mercadopago" else f"{pay_method.upper()} (Confirmado ✅)"

        admin_site_url = f"{FRONTEND_URL}/admin/pedidos"

        msg = (
            f"🛍️ *NOVA COMPRA CONFIRMADA NO SITE!* 🌿\n\n"
            f"Olá, Júlia! Acabou de entrar uma nova venda na Ecosopis:\n\n"
            f"📦 *Pedido:* #{order.id}\n"
            f"👤 *Cliente:* {buyer_name}\n"
            f"📱 *WhatsApp:* {buyer_phone}\n"
            f"🆔 *CPF:* {buyer_cpf}\n"
            f"✉️ *E-mail:* {buyer_email}\n"
            f"💳 *Pagamento:* {pay_method_label}\n"
            f"💰 *Valor Total:* R$ {order.total:.2f}\n\n"
            f"🛒 *Produtos Comprados:*\n"
            f"{items_text}\n\n"
            f"📍 *Endereço de Entrega:*\n"
            f"{address_text}\n\n"
            f"🚚 *Logística:* O envio foi adicionado ao carrinho do Melhor Envio para emissão da etiqueta.\n"
            f"🔗 *Gerenciar no Painel:* {admin_site_url}"
        )

        logger.info(f"[WhatsApp Júlia] Disparando notificação de venda #{order.id} para {JULIA_WHATSAPP_NUMBER}...")
        return send_whatsapp_notification(
            phone=JULIA_WHATSAPP_NUMBER,
            message=msg,
            trigger_type="admin_new_order_julia",
            recipient_name="Júlia - ECOSOPIS"
        )
    except Exception as e:
        logger.error(f"[WhatsApp Júlia] Erro ao disparar notificação para Júlia: {e}", exc_info=True)
        return False

def notify_customer_order_shipped(order: models.Order, db: Session, tracking_code: Optional[str] = None) -> bool:
    """
    Dispara notificação de pedido enviado via WhatsApp para o cliente, incluindo código e link de rastreamento.
    """
    try:
        phone = order.customer_phone or (order.user.phone if order.user else None)
        if not phone:
            return False

        client_name = order.customer_name or order.buyer_name or (order.user.full_name if order.user else "Cliente")
        code = tracking_code or order.codigo_rastreio or ""
        
        tracking_url = f"https://melhorrastreio.com.br/rastreio/{code}" if code else f"{FRONTEND_URL}/pedido/{order.id}"

        # Contexto para substituição no template ativo
        context = {
            "cliente": client_name,
            "pedido": order.id,
            "codigo_rastreio": code or "Disponível em breve",
            "link_rastreio": tracking_url
        }

        # Tenta disparar usando template configurado
        sent = trigger_whatsapp_event("order_shipped", phone, context, db, recipient_name=client_name)
        if not sent:
            # Fallback direto caso o template não esteja habilitado
            msg = (
                f"Ótimas notícias, {client_name}! 📦✨\n\n"
                f"Seu pedido *#{order.id}* da ECOSOPIS acabou de ser enviado! 🚚\n"
            )
            if code:
                msg += f"\nCódigo de Rastreio: *{code}*\n🔗 Acompanhe seu envio: {tracking_url}\n"
            else:
                msg += f"\nO código de rastreamento estará disponível muito em breve no site.\n"
            msg += "\nQualquer dúvida, estamos à sua inteira disposição! 🌿"

            return send_whatsapp_notification(
                phone=phone,
                message=msg,
                trigger_type="order_shipped",
                recipient_name=client_name
            )
        return True
    except Exception as e:
        logger.error(f"[WhatsApp Cliente] Erro ao notificar envio do pedido #{order.id}: {e}")
        return False

def notify_customer_order_delivered(order: models.Order, db: Session) -> bool:
    """
    Dispara notificação de pedido entregue via WhatsApp para o cliente.
    """
    try:
        phone = order.customer_phone or (order.user.phone if order.user else None)
        if not phone:
            return False

        client_name = order.customer_name or order.buyer_name or (order.user.full_name if order.user else "Cliente")
        
        context = {
            "cliente": client_name,
            "pedido": order.id
        }

        sent = trigger_whatsapp_event("order_delivered", phone, context, db, recipient_name=client_name)
        if not sent:
            msg = (
                f"Olá, {client_name}! 🏠✨\n\n"
                f"Consta em nosso sistema que seu pedido *#{order.id}* foi *ENTREGUE* com sucesso! 🎉\n\n"
                f"Esperamos que você ame a sua experiência com os cosméticos naturais e veganos da ECOSOPIS. 🌿\n\n"
                f"Se puder, nos conte o que achou ou deixe uma avaliação no site. Muito obrigada pelo carinho!"
            )
            return send_whatsapp_notification(
                phone=phone,
                message=msg,
                trigger_type="order_delivered",
                recipient_name=client_name
            )
        return True
    except Exception as e:
        logger.error(f"[WhatsApp Cliente] Erro ao notificar entrega do pedido #{order.id}: {e}")
        return False

