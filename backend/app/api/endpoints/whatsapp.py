from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_admin
from app.services.whatsapp import send_whatsapp_notification, trigger_whatsapp_event
import requests
import os

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000").rstrip("/")

class SendMessageRequest(BaseModel):
    to: str
    message: str
    trigger_type: Optional[str] = "manual"
    recipient_name: Optional[str] = None

class TemplateUpdateRequest(BaseModel):
    message_template: str
    is_enabled: bool = True
    delay_minutes: int = 0

@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    account = db.query(models.WhatsAppAccount).filter(models.WhatsAppAccount.id == "default").first()
    if not account:
        return {
            "status": "DISCONNECTED",
            "phone": None,
            "qrCode": None,
            "lastConnection": None
        }
    return {
        "status": account.status,
        "phone": account.phone,
        "qrCode": account.qr_code,
        "lastConnection": account.last_connection
    }

@router.post("/connect")
def proxy_connect():
    try:
        res = requests.post(f"{FRONTEND_URL}/api/whatsapp/connect", timeout=15)
        return res.json()
    except Exception as e:
        return {"status": "CONNECTING", "message": str(e)}

@router.post("/disconnect")
def proxy_disconnect(payload: Dict[str, Any] = None):
    try:
        res = requests.post(f"{FRONTEND_URL}/api/whatsapp/disconnect", json=payload or {}, timeout=15)
        return res.json()
    except Exception as e:
        return {"status": "DISCONNECTED", "message": str(e)}

@router.post("/send")
def send_message(payload: SendMessageRequest, db: Session = Depends(get_db)):
    success = send_whatsapp_notification(
        phone=payload.to,
        message=payload.message,
        trigger_type=payload.trigger_type,
        recipient_name=payload.recipient_name or ""
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível enviar a mensagem. Verifique se o WhatsApp está conectado no painel admin."
        )
    return {"status": "success", "message": "Mensagem enviada com sucesso!"}

@router.get("/templates")
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(models.WhatsAppTemplate).order_by(models.WhatsAppTemplate.id.asc()).all()
    return {"templates": templates}

@router.put("/templates/{trigger_type}")
def update_template(
    trigger_type: str,
    payload: TemplateUpdateRequest,
    db: Session = Depends(get_db)
):
    tpl = db.query(models.WhatsAppTemplate).filter(models.WhatsAppTemplate.trigger_type == trigger_type).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")

    tpl.message_template = payload.message_template
    tpl.is_enabled = payload.is_enabled
    tpl.delay_minutes = payload.delay_minutes
    db.commit()
    db.refresh(tpl)
    return {"status": "success", "template": tpl}

@router.get("/messages")
def list_messages(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(models.WhatsAppMessageLog).order_by(models.WhatsAppMessageLog.created_at.desc()).limit(limit).all()
    return {"messages": logs}
