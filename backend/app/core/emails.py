import resend
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
STORE_NAME = os.getenv("STORE_NAME", "ECOSOPIS")
# The "from" address should be verified in your Resend dashboard
FROM_EMAIL = os.getenv("FROM_EMAIL", f"{STORE_NAME} <nao-responda@ecosopis.com.br>")

# DEBUG: Force push to resolve indentation issues
def send_email(to_email: str, subject: str, html_content: str, attachments: List[Dict[str, Any]] | None = None):
    """Send an email via Resend. Supports optional attachments.
    Attachments should be a list of dicts with keys: 'filename', 'content' (base64 string), 'type'."""
    try:
        params: Dict[str, Any] = {
            "from": FROM_EMAIL,
            "to": to_email,
            "subject": subject,
            "html": html_content,
        }
        if attachments:
            params["attachments"] = attachments
        r = resend.Emails.send(params)
        print(f"Email sent successfully to {to_email}. Response ID: {r.get('id')}")
        return True
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to send email to {to_email}. Error: {str(e)}")
        return False


def send_verification_email(email: str, token: str):
    verification_link = f"{FRONTEND_URL}/verify-email?token={token}"
    subject = "🌳 Bem-vinda à ECOSOPIS! Confirme seu e-mail"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #4B8411; text-align: center;">Olá! Ficamos muito felizes com seu cadastro.</h2>
        <p>Para começar a cuidar da sua pele com o poder da natureza, precisamos apenas que você confirme seu e-mail clicando no botão abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_link}" style="background-color: #4B8411; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Confirmar meu E-mail</a>
        </div>
        <p style="color: #666; font-size: 0.9rem;">Se o botão não funcionar, copie e cole este link no seu navegador: <br> {verification_link}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="text-align: center; color: #999; font-size: 0.8rem;">Equipe ECOSOPIS - Cosméticos Naturais e Veganos</p>
    </div>
    """
    return send_email(email, subject, html)

def send_order_confirmation_with_pdf(email: str, order_id: int, items: List[Dict[str, Any]], total: float, pdf_bytes: bytes):
    """Send order confirmation email with PDF attachment of the order invoice/label."""
    subject = f"✨ Pedido #{order_id} Confirmado! - ECOSOPIS"
    items_html = "".join([f"<li>{item['name']} (x{item['quantity']}) - R$ {item['price']:.2f}</li>" for item in items])
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #4B8411;">Obrigada por escolher a ECOSOPIS!</h2>
        <p>Seu pedido <strong>#{order_id}</strong> foi recebido com sucesso e já estamos preparando tudo com muito carinho.</p>
        <h3>Resumo do Pedido:</h3>
        <ul>{items_html}</ul>
        <p><strong>Total: R$ {total:.2f}</strong></p>
        <p>Você receberá novas atualizações assim que seu pacote for enviado.</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="{FRONTEND_URL}/minha-conta/pedidos" style="color: #4B8411; font-weight: bold;">Acompanhar meu pedido</a>
        </div>
    </div>
    """
    import base64
    b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
    attachments = [{
        "filename": f"pedido_{order_id}.pdf",
        "content": b64_pdf,
        "type": "application/pdf"
    }]
    return send_email(email, subject, html, attachments)

def send_order_update_email(email: str, order_id: int, status: str):
    status_map = {
        "paid": "Pagamento Confirmado! ✅",
        "shipped": "Seu pedido está a caminho! 🚚",
        "delivered": "Pedido Entregue! 🏠",
        "cancelled": "Pedido Cancelado"
    }
    status_text = status_map.get(status, status)
    subject = f"📦 Atualização no Pedido #{order_id} - {status_text}"
    
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #4B8411;">Temos novidades sobre o seu pedido!</h2>
        <p>O status do seu pedido <strong>#{order_id}</strong> foi atualizado para:</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; font-size: 1.2rem; font-weight: bold; color: #333;">
            {status_text}
        </div>
        <p style="margin-top: 20px;">Para mais detalhes, acesse sua conta no nosso site.</p>
    </div>
    """
    return send_email(email, subject, html)

def send_order_confirmation_email(email: str, order_id: int, items: List[Dict[str, Any]], total: float):
    subject = f"✨ Pedido #{order_id} Confirmado! - ECOSOPIS"
    items_html = "".join([f"<li>{item.get('name') or item.get('product_name')} (x{item.get('quantity', 1)}) - R$ {item.get('price', 0.0):.2f}</li>" for item in items])
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #4B8411;">Obrigada por escolher a ECOSOPIS!</h2>
        <p>Seu pedido <strong>#{order_id}</strong> foi recebido com sucesso e já estamos preparando tudo com muito carinho.</p>
        <h3>Resumo do Pedido:</h3>
        <ul>{items_html}</ul>
        <p><strong>Total: R$ {total:.2f}</strong></p>
        <p>Você receberá novas atualizações assim que seu pacote for enviado.</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="{FRONTEND_URL}/minha-conta/pedidos" style="color: #4B8411; font-weight: bold;">Acompanhar meu pedido</a>
        </div>
    </div>
    """
    return send_email(email, subject, html)


def send_admin_notification_email(admin_email: str, order_id: int, total: float, customer_name: str, order: Any = None):
    subject = f"🚨 Nova Venda Realizada! Pedido #{order_id}"
    
    if order:
        # Formatar itens
        items_list = getattr(order, "items", None) or []
        if not items_list and hasattr(order, "order_items") and order.order_items:
            items_list = [
                {
                    "name": item.product.name if item.product else (getattr(item, "product_name", "Produto")),
                    "quantity": item.quantity,
                    "price": item.price
                }
                for item in order.order_items
            ]
        
        items_rows = ""
        for item in items_list:
            name = item.get("name") or item.get("product_name") or "Produto"
            qty = item.get("quantity") or 1
            price = item.get("price") or 0.0
            sub = price * qty
            items_rows += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155;">{name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #334155;">{qty}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #334155;">R$ {price:.2f}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; color: #1e293b;">R$ {sub:.2f}</td>
            </tr>
            """
            
        # Formatar endereço
        addr = getattr(order, "address", None) or {}
        street = addr.get("street") or addr.get("logradouro") or "Endereço não informado"
        number = addr.get("number") or "S/N"
        complement = f" - {addr.get('complement')}" if addr.get("complement") else ""
        neighborhood = addr.get("neighborhood") or addr.get("bairro") or ""
        city = addr.get("city") or addr.get("localidade") or ""
        state = addr.get("state") or addr.get("uf") or ""
        cep = addr.get("postal_code") or addr.get("cep") or ""
        
        address_html = f"""
        <strong>Logradouro:</strong> {street}, {number}{complement}<br>
        <strong>Bairro:</strong> {neighborhood}<br>
        <strong>Cidade/UF:</strong> {city}/{state.upper()}<br>
        <strong>CEP:</strong> {cep}
        """
        
        # Descontos
        discount_rows = ""
        discount_amount = getattr(order, "discount_amount", 0.0) or 0.0
        if discount_amount > 0:
            coupon_part = f" ({order.coupon_code})" if getattr(order, "coupon_code", None) else ""
            discount_rows = f"""
            <tr>
                <td colspan="3" style="padding: 6px 10px; text-align: right; color: #64748b;">Desconto{coupon_part}:</td>
                <td style="padding: 6px 10px; text-align: right; color: #059669; font-weight: bold;">-R$ {discount_amount:.2f}</td>
            </tr>
            """
            
        shipping_price = getattr(order, "shipping_price", 0.0) or 0.0
        shipping_method = getattr(order, "shipping_method", "Padrão") or "Padrão"
        payment_method = getattr(order, "payment_method", "N/A") or "N/A"
        payment_text = "Mercado Pago" if payment_method == "mercadopago" else "Stripe" if payment_method == "stripe" else payment_method.upper()
        
        customer_email = getattr(order, "buyer_email", None) or getattr(order, "customer_email", None) or "N/A"
        customer_phone = getattr(order, "customer_phone", None) or "N/A"
        customer_cpf = getattr(order, "customer_cpf", None) or "N/A"
        
        html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2d5a27; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 1.5rem; font-weight: bold; letter-spacing: -0.5px;">🚨 Nova Venda Realizada!</h1>
                <p style="margin: 6px 0 0; opacity: 0.9; font-size: 0.9rem;">Pedido #{order_id} • ECOSOPIS</p>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
                <h2 style="color: #2d5a27; font-size: 1.15rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0; margin-bottom: 16px;">👤 Dados do Cliente</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 24px; line-height: 1.5;">
                    <tr>
                        <td style="padding: 4px 0; color: #64748b; width: 120px;">Nome:</td>
                        <td style="padding: 4px 0; font-weight: bold; color: #1e293b;">{customer_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #64748b;">CPF:</td>
                        <td style="padding: 4px 0; color: #1e293b;">{customer_cpf}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #64748b;">E-mail:</td>
                        <td style="padding: 4px 0; color: #1e293b;">{customer_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #64748b;">WhatsApp/Tel:</td>
                        <td style="padding: 4px 0; color: #1e293b;">{customer_phone}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #64748b;">Forma de Pgto:</td>
                        <td style="padding: 4px 0; font-weight: bold; color: #2d5a27;">{payment_text}</td>
                    </tr>
                </table>

                <h2 style="color: #2d5a27; font-size: 1.15rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0; margin-bottom: 16px;">🛒 Itens do Pedido</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 24px;">
                    <thead>
                        <tr style="background-color: #f8fafc; text-align: left;">
                            <th style="padding: 10px; color: #64748b; font-weight: 600;">Produto</th>
                            <th style="padding: 10px; color: #64748b; font-weight: 600; text-align: center; width: 50px;">Qtd</th>
                            <th style="padding: 10px; color: #64748b; font-weight: 600; text-align: right; width: 90px;">Preço Unit.</th>
                            <th style="padding: 10px; color: #64748b; font-weight: 600; text-align: right; width: 90px;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_rows}
                    </tbody>
                </table>

                <h2 style="color: #2d5a27; font-size: 1.15rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0; margin-bottom: 16px;">📍 Endereço de Entrega</h2>
                <div style="font-size: 0.85rem; color: #334155; line-height: 1.6; background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9; margin-bottom: 24px;">
                    {address_html}
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 16px;">
                    <tr>
                        <td colspan="3" style="padding: 6px 10px; text-align: right; color: #64748b;">Frete ({shipping_method}):</td>
                        <td style="padding: 6px 10px; text-align: right; color: #1e293b;">R$ {shipping_price:.2f}</td>
                    </tr>
                    {discount_rows}
                    <tr style="font-size: 1.1rem; font-weight: bold; color: #2d5a27; border-top: 2px dashed #e2e8f0;">
                        <td colspan="3" style="padding: 14px 10px 0; text-align: right;">Total Geral:</td>
                        <td style="padding: 14px 10px 0; text-align: right;">R$ {total:.2f}</td>
                    </tr>
                </table>

                <div style="text-align: center; margin-top: 32px; margin-bottom: 8px;">
                    <a href="{FRONTEND_URL}/admin/pedidos" style="background-color: #2d5a27; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 0.9rem; display: inline-block;">Acessar Painel de Pedidos</a>
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Equipe ECOSOPIS • Painel Automático de Vendas
            </div>
        </div>
        """
    else:
        html = f"""
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: #2d5a27;">Nova venda no site!</h2>
            <p>Um novo pedido foi finalizado.</p>
            <p><strong>Pedido:</strong> #{order_id}</p>
            <p><strong>Cliente:</strong> {customer_name}</p>
            <p><strong>Valor Total:</strong> R$ {total:.2f}</p>
            <p>Acesse o painel administrativo para processar o pedido.</p>
        </div>
        """
    return send_email(admin_email, subject, html)

def send_abandoned_cart_email(email: str, name: str):
    subject = "🍃 Esqueceu algo especial no carrinho?"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #4B8411;">Olá, {name}!</h2>
        <p>Vimos que você escolheu alguns produtos naturais incríveis, mas não finalizou sua compra.</p>
        <p>Ainda separamos seus itens favoritos por aqui! Que tal dar esse presente para sua pele hoje?</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{FRONTEND_URL}/carrinho" style="background-color: #4B8411; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Voltar para o meu carrinho</a>
        </div>
        <footer style="margin-top: 20px; font-size: 0.8rem; color: #999;">
            Se precisar de ajuda com seu pedido, responda a este e-mail.
        </footer>
    </div>
    """
    return send_email(email, subject, html)
