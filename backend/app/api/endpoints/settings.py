from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import SystemSetting
from app.core.security import get_current_admin_user
from app.core import emails

router = APIRouter()

@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings}

@router.post("/")
def update_setting(data: dict, db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    for key, value in data.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            setting = SystemSetting(key=key, value=str(value))
            db.add(setting)
    db.commit()
    return {"message": "Configurações atualizadas"}

@router.post("/test-email")
def test_email(db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    """Sends a test email to the store email to verify Resend configuration."""
    # Get the admin notification email from settings
    admin_email_setting = db.query(SystemSetting).filter(SystemSetting.key == "admin_order_notification_email").first()
    target_email = admin_email_setting.value if admin_email_setting else "contato@ecosopis.com.br"
    
    success = emails.send_email(
        target_email, 
        "🌳 Teste de Conexão ECOSOPIS", 
        "<h1>Conexão com Resend ativa!</h1><p>Se você está lendo isso, a configuração do seu e-mail está funcionando corretamente.</p>"
    )
    
    if success:
        return {"message": f"E-mail de teste enviado para {target_email}. Verifique sua caixa de entrada."}
    else:
        raise HTTPException(status_code=500, detail="Falha ao enviar e-mail. Verifique a chave de API no Railway e se o domínio está verificado no Resend.")
