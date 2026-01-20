from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import SystemSetting
from app.core.security import get_current_admin_user

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
