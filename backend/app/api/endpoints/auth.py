from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core import security, emails
from app.core.upload_content_type import resolve_stored_image_content_type
from app.models import models
from app.schemas import schemas
from jose import jwt, JWTError
import os
import uuid

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

@router.post("/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"DEBUG: Registering user {user_in.email}")
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user_in.password)
    # Check roulette config for new user rule
    config = db.query(models.RouletteConfig).first()
    can_spin = False
    if config and config.ativa and config.regra_novo_usuario:
        can_spin = True

    verification_token = str(uuid.uuid4())
    
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        phone=user_in.phone,
        role="client",
        pode_girar_roleta=can_spin,
        is_verified=False,
        verification_token=verification_token
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send Verification Email
    emails.send_verification_email(new_user.email, verification_token)
    
    return new_user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    except Exception:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_user_optional(
    db: Session = Depends(get_db), token: Optional[str] = Depends(oauth2_scheme_optional)
):
    if not token:
        return None
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        return user
    except (JWTError, ValueError, TypeError):
        return None

async def get_current_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    return db.query(models.User).all()


def _executar_envio_emails_bg(
    subject: str,
    body: str,
    recipient_emails: List[str],
    attachments: List[Dict[str, Any]] | None = None
):
    """
    Background task to send custom styled emails to users.
    """
    for email_addr in recipient_emails:
        try:
            html_content = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="background-color: #2d5a27; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 1.4rem;">{subject}</h1>
                </div>
                <div style="padding: 24px; color: #334155; line-height: 1.6; font-size: 1rem; white-space: pre-wrap;">
{body}
                </div>
                <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 0.75rem; color: #94a3b8; border-radius: 0 0 8px 8px; border-top: 1px solid #eee;">
                    Equipe ECOSOPIS - Cosméticos Naturais e Veganos
                </div>
            </div>
            """
            emails.send_email(email_addr, subject, html_content, attachments)
        except Exception as e:
            print(f"[BG Email] Erro ao enviar e-mail para {email_addr}: {str(e)}")


@router.post("/users/send-email")
async def send_custom_emails(
    background_tasks: BackgroundTasks,
    subject: str = Form(...),
    body: str = Form(...),
    user_ids: str = Form(...),  # "all" or a JSON-encoded string of list of user IDs
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    import json
    import base64
    
    recipient_emails = []
    if user_ids == "all":
        users = db.query(models.User).all()
        recipient_emails = [u.email for u in users if u.email]
    else:
        try:
            ids = json.loads(user_ids)
            if not isinstance(ids, list):
                raise ValueError()
            ids = [int(i) for i in ids]
            users = db.query(models.User).filter(models.User.id.in_(ids)).all()
            recipient_emails = [u.email for u in users if u.email]
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Formato inválido para user_ids. Deve ser 'all' ou um array JSON de IDs."
            )

    if not recipient_emails:
        raise HTTPException(status_code=400, detail="Nenhum destinatário com e-mail cadastrado foi encontrado.")

    # Process attachments
    attachments = []
    if files:
        for file in files:
            if file.filename:
                content = await file.read()
                b64_content = base64.b64encode(content).decode("utf-8")
                attachments.append({
                    "filename": file.filename,
                    "content": b64_content,
                    "type": file.content_type or "application/octet-stream"
                })

    background_tasks.add_task(
        _executar_envio_emails_bg,
        subject,
        body,
        recipient_emails,
        attachments
    )

    return {"message": f"Envio de e-mail iniciado para {len(recipient_emails)} destinatários em segundo plano."}

@router.get("/users/{user_id}", response_model=schemas.UserProfileResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/me", response_model=schemas.UserProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.refresh(current_user)
    return current_user

@router.put("/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    profile_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name
    if profile_data.profile_picture is not None:
        current_user.profile_picture = profile_data.profile_picture
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/me/password")
def update_password(
    password_data: schemas.UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not security.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    current_user.hashed_password = security.get_password_hash(password_data.new_password)
    db.commit()
    return {"message": "Senha atualizada com sucesso"}

@router.post("/me/profile-picture", response_model=schemas.UserResponse)
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    content = await file.read()
    fn = file.filename or f"profile_{uuid.uuid4()}.jpg"
    content_type = resolve_stored_image_content_type(
        filename=fn, declared=file.content_type, fallback="image/jpeg"
    )

    stored_image = models.StoredImage(
        filename=fn,
        content_type=content_type,
        data=content
    )
    db.add(stored_image)
    db.commit()
    db.refresh(stored_image)
    
    current_user.profile_picture = f"/api/images/{stored_image.id}"
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    db.delete(user)
    db.commit()
    return None

@router.post("/users/{user_id}/promote", response_model=schemas.UserResponse)
def promote_to_admin(user_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = "admin"
    db.commit()
    db.refresh(user)
    return user

@router.post("/users/{user_id}/blog-permission")
def toggle_blog_permission(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    """Grant or revoke blog posting permission for a user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Admins always can post, no need to toggle
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admins already have full access")
    user.can_post_news = not user.can_post_news
    db.commit()
    db.refresh(user)
    return {"user_id": user_id, "can_post_news": user.can_post_news, "email": user.email}

@router.post("/users/{user_id}/toggle-roulette")
def toggle_roulette_permission(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    """Grant or revoke roulette spin permission for a user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.pode_girar_roleta = not user.pode_girar_roleta
    db.commit()
    db.refresh(user)
    return {"user_id": user_id, "pode_girar_roleta": user.pode_girar_roleta, "email": user.email}

@router.get("/users/{user_id}/blog-permission")
def get_blog_permission(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": user_id, "can_post_news": user.can_post_news or user.role == "admin"}


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    print(f"DEBUG: Login attempt for {form_data.username}")
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="E-mail não verificado. Por favor, verifique seu e-mail para acessar sua conta."
        )
    
    access_token = security.create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}
@router.get("/verify-token")
async def verify_token(current_user: models.User = Depends(get_current_user)):
    return {
        "status": "ok",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "full_name": current_user.full_name
        }
    }

@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token de verificação inválido ou expirado")
    
    user.is_verified = True
    user.verification_token = None # Clear token after verification
    db.commit()
    
    return {"message": "E-mail verificado com sucesso! Agora você pode fazer login."}

@router.post("/forgot-password")
def forgot_password(email_data: schemas.ForgotPassword, db: Session = Depends(get_db)):
    """
    Always returns the same response to avoid email enumeration.
    Generates a 1-hour expiring token, stores it on the user, and sends a reset e-mail.
    """
    from datetime import datetime, timedelta, timezone
    import uuid

    user = db.query(models.User).filter(models.User.email == email_data.email).first()
    if user:
        token = str(uuid.uuid4())
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        emails.send_password_reset_email(user.email, token)

    return {"message": "Se o e-mail existir em nosso sistema, você receberá um link de recuperação em instantes."}


@router.post("/reset-password")
def reset_password(reset_data: schemas.ResetPassword, db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    user = db.query(models.User).filter(
        models.User.password_reset_token == reset_data.token
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

    # Check expiry
    if user.password_reset_expires is None or datetime.now(timezone.utc) > user.password_reset_expires:
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

    user.hashed_password = security.get_password_hash(reset_data.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()
    return {"message": "Senha redefinida com sucesso! Você já pode fazer login."}

