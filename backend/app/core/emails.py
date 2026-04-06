import resend
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000")
FROM_EMAIL = "ECOSOPIS <onboarding@resend.dev>" # Resend default for testing, should be updated to domain in production

def send_email(to_email: str, subject: str, html_content: str):
    try:
        params = {
            "from": FROM_EMAIL,
            "to": to_email,
            "subject": subject,
            "html": html_content,
        }
        r = resend.Emails.send(params)
        print(f"Email sent successfully to {to_email}. Response ID: {r.get('id')}")
        return True
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to send email to {to_email}. Error: {str(e)}")
        # If it's a domain verification issue, it will show up here
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

def send_order_confirmation_email(email: str, order_id: int, items: List[Dict[str, Any]], total: float):
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
    return send_email(email, subject, html)

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

def send_admin_notification_email(admin_email: str, order_id: int, total: float, customer_name: str):
    subject = f"🚨 Nova Venda Realizada! Pedido #{order_id}"
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
