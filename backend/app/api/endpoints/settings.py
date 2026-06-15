from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging
from app.core.database import get_db
from app.models.models import SystemSetting
from app.api.endpoints.auth import get_current_admin
from app.core import emails

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    try:
        settings = db.query(SystemSetting).all()
        return {s.key: s.value for s in settings}
    except Exception as e:
        logger.error(f"Error fetching system settings: {e}")
        return {}

@router.post("")
@router.post("/")
def update_setting(data: dict, db: Session = Depends(get_db), current_admin = Depends(get_current_admin)):
    try:
        for key, value in data.items():
            setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            if setting:
                setting.value = str(value)
            else:
                setting = SystemSetting(key=key, value=str(value))
                db.add(setting)
        db.commit()
        return {"message": "Configurações atualizadas"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating system settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao salvar configurações no banco de dados: {str(e)}"
        )

@router.post("/test-email")
def test_email(db: Session = Depends(get_db), current_admin = Depends(get_current_admin)):
    """Sends a test email to the store email to verify Resend configuration."""
    # Get the admin notification email from settings
    try:
        admin_email_setting = db.query(SystemSetting).filter(SystemSetting.key == "admin_order_notification_email").first()
        target_email = admin_email_setting.value if admin_email_setting else "contato@ecosopis.com.br"
    except Exception:
        target_email = "contato@ecosopis.com.br"
    
    success = emails.send_email(
        target_email, 
        "🌳 Teste de Conexão ECOSOPIS", 
        "<h1>Conexão com Resend activa!</h1><p>Se você está lendo isso, a configuração do seu e-mail está funcionando corretamente.</p>"
    )
    
    if success:
        return {"message": f"E-mail de teste enviado para {target_email}. Verifique sua caixa de entrada."}
    else:
        raise HTTPException(status_code=500, detail="Falha ao enviar e-mail. Verifique a chave de API no Railway e se o domínio está verificado no Resend.")

