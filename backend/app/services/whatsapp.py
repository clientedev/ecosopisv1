import os
import requests
import re
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import models

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000").rstrip("/")

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
        rendered = pattern.sub(str(value or ""), rendered)
    return rendered

def send_whatsapp_notification(
    phone: str,
    message: str,
    trigger_type: str = "manual",
    recipient_name: str = ""
) -> bool:
    """
    Função auxiliar reutilizável para disparar notificações via WhatsApp (Item 6).
    Envia requisição para a API local ou remota do WhatsApp Baileys.
    """
    clean_phone = format_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        print(f"[WhatsApp] Telefone inválido: {phone}")
        return False

    endpoint = f"{FRONTEND_URL}/api/whatsapp/send"
    payload = {
        "to": clean_phone,
        "message": message,
        "triggerType": trigger_type,
        "recipientName": recipient_name
    }

    try:
        res = requests.post(endpoint, json=payload, timeout=8)
        if res.status_code == 200:
            print(f"[WhatsApp] Mensagem ({trigger_type}) enviada com sucesso para {clean_phone}!")
            return True
        else:
            print(f"[WhatsApp] Falha ao enviar para {clean_phone}: {res.status_code} - {res.text}")
            return False
    except Exception as e:
        print(f"[WhatsApp] Erro de conexão com serviço WhatsApp: {e}")
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
            print(f"[WhatsApp] Nenhum template ativo para o gatilho '{trigger_type}'. Disparo ignorado.")
            return False

        message = render_template(tpl.message_template, context)
        return send_whatsapp_notification(
            phone=phone,
            message=message,
            trigger_type=trigger_type,
            recipient_name=recipient_name or str(context.get("cliente", ""))
        )
    except Exception as err:
        print(f"[WhatsApp] Erro ao disparar gatilho {trigger_type}: {err}")
        return False
