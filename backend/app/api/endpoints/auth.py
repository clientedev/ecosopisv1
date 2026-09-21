from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.core.database import get_db
from app.core import security, emails
from app.core.upload_content_type import resolve_stored_image_content_type
from app.models import models
from app.schemas import schemas
from jose import jwt, JWTError
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone
import os
import uuid
import json
import secrets
import logging
import httpx

logger = logging.getLogger(__name__)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

ALLOWED_ORIGINS = {
    "https://www.ecosopis.com.br",
    "https://ecosopis.com.br",
    "http://localhost:5000",
    "http://localhost:3000",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:3000",
}

def _get_safe_origin(request: Request) -> str:
    """Determine client origin, restricting to allowed domains."""
    referer = request.headers.get("referer") or ""
    origin = request.headers.get("origin") or ""
    
    for candidate in [origin, referer]:
        if candidate:
            for allowed in ALLOWED_ORIGINS:
                if candidate.startswith(allowed):
                    return allowed

    frontend_url = os.getenv("FRONTEND_URL", "https://ecosopis.com.br").strip().rstrip("/")
    if frontend_url in ALLOWED_ORIGINS:
        return frontend_url
    return "https://ecosopis.com.br"

def _validate_safe_origin(candidate: Optional[str]) -> str:
    if candidate and candidate in ALLOWED_ORIGINS:
        return candidate
    return "https://ecosopis.com.br"

def _sanitize_redirect_path(redirect: Optional[str]) -> str:
    if not redirect:
        return "/conta"
    if redirect.startswith("/") and not redirect.startswith("//") and "\\" not in redirect:
        return redirect
    return "/conta"


@router.post("/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"DEBUG: Registering user {user_in.email}")
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user_in.password)
    verification_token = str(uuid.uuid4())
    
    is_auto_verified = user_in.email.strip().lower() == "vaniafelixscj@hotmail.com"
    
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        phone=user_in.phone,
        role="client",
        is_verified=is_auto_verified,
        verification_token=None if is_auto_verified else verification_token
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send Verification Email
    if not is_auto_verified:
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
        if user.email and user.email.strip().lower() == "vaniafelixscj@hotmail.com":
            user.is_verified = True
            user.verification_token = None
            db.commit()
        else:
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


# ==========================================
# GOOGLE OAUTH 2.0 (INCREMENTAL & ISOLATED)
# ==========================================

@router.get("/google/login")
async def google_login(
    request: Request,
    redirect: Optional[str] = "/conta"
):
    """
    Inicia o fluxo de autorização OAuth 2.0 do Google.
    Gera state JWT assinado com destino e nonce CSRF,
    e redireciona para accounts.google.com.
    """
    client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        logger.warning("Tentativa de Google Login, mas GOOGLE_CLIENT_ID não está configurado.")
        return RedirectResponse(url="/conta?error=google_not_configured", status_code=302)

    redirect_uri = (os.getenv("GOOGLE_REDIRECT_URI") or "https://ecosopis.com.br/api/auth/google/callback").strip()
    clean_redirect = _sanitize_redirect_path(redirect)
    origin = _get_safe_origin(request)

    # Estado seguro com JWT
    state_payload = {
        "redirect": clean_redirect,
        "origin": origin,
        "nonce": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    state = jwt.encode(state_payload, security.SECRET_KEY, algorithm=security.ALGORITHM)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
        "access_type": "online"
    }
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url=google_auth_url, status_code=302)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Callback autorizado oficial do Google OAuth.
    URL exata configurada no Google Cloud: https://ecosopis.com.br/api/auth/google/callback
    """
    target_redirect = "/conta"
    target_origin = "https://ecosopis.com.br"

    if state:
        try:
            state_data = jwt.decode(state, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            target_redirect = _sanitize_redirect_path(state_data.get("redirect"))
            if state_data.get("origin"):
                target_origin = _validate_safe_origin(state_data.get("origin"))
        except Exception as e:
            logger.warning(f"Google OAuth state inválido ou expirado: {e}")
            return RedirectResponse(url="/conta?error=google_state_invalid", status_code=302)

    # 1. Tratamento de cancelamento ou erro reportado pelo Google
    if error:
        logger.info(f"Google OAuth retornou erro: {error} ({error_description})")
        err_code = "google_cancelled" if error in ["access_denied", "user_cancelled"] else "google_error"
        return RedirectResponse(url=f"{target_origin}/conta?error={err_code}", status_code=302)

    if not code:
        logger.warning("Google callback invocado sem authorization code.")
        return RedirectResponse(url=f"{target_origin}/conta?error=google_error", status_code=302)

    # 2. Validação de credenciais do ambiente
    client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
    redirect_uri = (os.getenv("GOOGLE_REDIRECT_URI") or "https://ecosopis.com.br/api/auth/google/callback").strip()

    if not client_id or not client_secret:
        logger.error("Credenciais do Google não configuradas nas variáveis de ambiente.")
        return RedirectResponse(url=f"{target_origin}/conta?error=google_not_configured", status_code=302)

    # 3. Troca do code por access_token e id_token com o Google
    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(token_url, data=token_payload)
            if token_resp.status_code != 200:
                logger.error(f"Troca de token Google falhou (status {token_resp.status_code}): {token_resp.text}")
                return RedirectResponse(url=f"{target_origin}/conta?error=google_auth_failed", status_code=302)

            token_data = token_resp.json()
            google_access_token = token_data.get("access_token")
            if not google_access_token:
                logger.error("Google não retornou access_token.")
                return RedirectResponse(url=f"{target_origin}/conta?error=google_auth_failed", status_code=302)

            # 4. Obter e validar identidade verificada no endpoint oficial OpenID Connect do Google
            userinfo_url = "https://openidconnect.googleapis.com/v1/userinfo"
            userinfo_resp = await client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {google_access_token}"}
            )
            if userinfo_resp.status_code != 200:
                logger.error(f"Falha ao obter userinfo do Google (status {userinfo_resp.status_code})")
                return RedirectResponse(url=f"{target_origin}/conta?error=google_auth_failed", status_code=302)

            userinfo = userinfo_resp.json()
    except Exception as e:
        logger.error(f"Exceção na comunicação com o Google: {e}")
        return RedirectResponse(url=f"{target_origin}/conta?error=google_error", status_code=302)

    # 5. Validação rigorosa dos dados recebidos
    google_sub = userinfo.get("sub")
    email = userinfo.get("email")
    email_verified = userinfo.get("email_verified")
    full_name = userinfo.get("name") or ""
    picture = userinfo.get("picture")

    if not google_sub or not email:
        logger.error("Google userinfo não contém sub ou email válidos.")
        return RedirectResponse(url=f"{target_origin}/conta?error=google_email_unavailable", status_code=302)

    if not email_verified:
        logger.warning(f"E-mail do Google {email} não verificado.")
        return RedirectResponse(url=f"{target_origin}/conta?error=google_email_unverified", status_code=302)

    normalized_email = email.strip().lower()

    # 6. Localização ou cadastro seguro no banco de dados
    user = None
    # Busca por e-mail no banco
    db_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()

    if db_user:
        # Usuário existente: NENHUMA alteração de role, permissões, senha, pedidos ou histórico
        if not db_user.google_id:
            db_user.google_id = str(google_sub)
        if not db_user.is_verified:
            db_user.is_verified = True
            db_user.verification_token = None
        # Atualiza foto de perfil apenas se o usuário ainda não tiver uma personalizada
        if not db_user.profile_picture and picture:
            db_user.profile_picture = picture
        db.commit()
        db.refresh(db_user)
        user = db_user
    else:
        # Verifica se porventura o google_id já existe associado a outra conta
        existing_google = db.query(models.User).filter(models.User.google_id == str(google_sub)).first()
        if existing_google:
            user = existing_google
        else:
            # Novo usuário: cadastro automático seguro com permissões padrão de cliente
            # Hash forte e imprevisível para preencher o campo NOT NULL de senha com total segurança
            random_password = secrets.token_urlsafe(48)
            hashed_pwd = security.get_password_hash(random_password)

            user = models.User(
                email=normalized_email,
                hashed_password=hashed_pwd,
                full_name=full_name or normalized_email.split("@")[0],
                role="client",
                is_verified=True,
                verification_token=None,
                google_id=str(google_sub),
                auth_provider="google",
                profile_picture=picture if picture else None,
                total_compras=0,
                can_post_news=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    # 7. Criar sessão / JWT com o mesmo mecanismo padrão do sistema
    access_token = security.create_access_token(subject=user.id)

    # 8. Retornar página de transição para persistência segura no localStorage e redirecionamento
    safe_token = json.dumps(access_token)
    safe_target = json.dumps(target_redirect)
    safe_origin = json.dumps(target_origin)

    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Entrando no Ecosopis...</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f8fafc;
            color: #2d5a27;
        }}
        .card {{
            text-align: center;
            padding: 32px 24px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            max-width: 380px;
            width: 90%;
        }}
        .spinner {{
            width: 44px;
            height: 44px;
            border: 4px solid #e2e8f0;
            border-top: 4px solid #2d5a27;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px;
        }}
        @keyframes spin {{
            0% {{ transform: rotate(0deg); }}
            100% {{ transform: rotate(360deg); }}
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <h2 style="margin: 0 0 8px; font-size: 1.15rem; color: #1a3a16;">Autenticado com sucesso!</h2>
        <p style="margin: 0; color: #64748b; font-size: 0.88rem;">Redirecionando para o Ecosopis...</p>
    </div>
    <script>
        (function() {{
            try {{
                var token = {safe_token};
                var target = {safe_target} || '/conta';
                var origin = {safe_origin};
                
                // Armazena credenciais da sessão no navegador
                localStorage.setItem('token', token);
                localStorage.setItem('remember_me', 'true');
                sessionStorage.setItem('session_active', 'true');
                sessionStorage.removeItem('roulette_spin_shown');
                
                // Redireciona imediatamente
                if (window.location.origin === origin || !origin) {{
                    window.location.replace(target);
                }} else {{
                    var delimiter = target.indexOf('?') === -1 ? '?' : '&';
                    window.location.replace(origin + target + delimiter + 'token=' + encodeURIComponent(token));
                }}
            }} catch(e) {{
                window.location.replace('/conta?token=' + encodeURIComponent({safe_token}));
            }}
        }})();
    </script>
</body>
</html>"""
    return HTMLResponse(content=html_content, status_code=200)


