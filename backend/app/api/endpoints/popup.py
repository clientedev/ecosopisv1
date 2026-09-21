import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db, SessionLocal
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from app.core import emails

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")


def _get_valid_unique_user_emails(db: Session) -> List[str]:
    """Recupera todos os e-mails válidos e únicos dos usuários cadastrados."""
    users = db.query(models.User.email).filter(models.User.email.isnot(None)).all()
    unique = set()
    for row in users:
        email = (row[0] or "").strip().lower()
        if email and EMAIL_REGEX.match(email):
            unique.add(email)
    return sorted(list(unique))


def _dispatch_campaign_in_background(
    log_id: int,
    recipient_emails: List[str],
    subject: str,
    title: str,
    body: str,
    image_url: str | None,
    coupon_code: str | None,
    discount_info: str | None,
    button_text: str,
    button_link: str
):
    """Executa o envio em lote em segundo plano e atualiza o log ao final."""
    db = SessionLocal()
    try:
        sent_count = 0
        failed_count = 0

        for addr in recipient_emails:
            try:
                ok = emails.send_promotional_campaign_email(
                    email=addr,
                    subject=subject,
                    title=title,
                    body=body,
                    image_url=image_url,
                    coupon_code=coupon_code,
                    discount_info=discount_info,
                    button_text=button_text,
                    button_link=button_link
                )
                if ok:
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as ex:
                print(f"[Campaign Dispatch] Erro ao enviar para {addr}: {ex}")
                failed_count += 1

        # Atualiza status no banco
        log_entry = db.query(models.CampaignDispatchLog).filter(models.CampaignDispatchLog.id == log_id).first()
        if log_entry:
            log_entry.status = "completed" if failed_count == 0 else f"completed ({sent_count} enviados, {failed_count} falhas)"
            db.commit()

        print(f"[Campaign Dispatch] Disparo #{log_id} finalizado. Sucessos: {sent_count}, Falhas: {failed_count}")
    except Exception as e:
        print(f"[Campaign Dispatch] Erro fatal no disparo #{log_id}: {e}")
        try:
            log_entry = db.query(models.CampaignDispatchLog).filter(models.CampaignDispatchLog.id == log_id).first()
            if log_entry:
                log_entry.status = "failed"
                db.commit()
        except:
            pass
    finally:
        db.close()


@router.get("", response_model=schemas.PopupPublicResponse)
def get_public_popup(db: Session = Depends(get_db)):
    """Retorna a configuração do pop-up ativo para exibição no site."""
    popup = db.query(models.PromotionalPopup).first()
    if not popup or not popup.is_active:
        return schemas.PopupPublicResponse(
            is_active=False,
            title="",
            description="",
            image_url=None,
            button_text="Aproveitar Desconto",
            button_link="/produtos",
            frequency="once_per_session",
            delay_seconds=3
        )

    # Detalhes do cupom vinculado se existir e estiver ativo
    coupon_code = None
    discount_type = None
    discount_value = None
    min_purchase_value = 0.0

    if popup.coupon_id:
        coupon = db.query(models.Coupon).filter(models.Coupon.id == popup.coupon_id).first()
        if coupon and coupon.is_active:
            # Checa se não expirou
            now = datetime.now(timezone.utc)
            is_valid = True
            if coupon.valid_until and coupon.valid_until < now:
                is_valid = False
            if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
                is_valid = False

            if is_valid:
                coupon_code = coupon.code
                discount_type = coupon.discount_type
                discount_value = coupon.discount_value
                min_purchase_value = coupon.min_purchase_value or 0.0

    return schemas.PopupPublicResponse(
        is_active=popup.is_active,
        title=popup.title,
        description=popup.description or "",
        image_url=popup.image_url,
        button_text=popup.button_text or "Aproveitar Desconto",
        button_link=popup.button_link or "/produtos",
        frequency=popup.frequency or "once_per_session",
        delay_seconds=popup.delay_seconds if popup.delay_seconds is not None else 3,
        coupon_code=coupon_code,
        discount_type=discount_type,
        discount_value=discount_value,
        min_purchase_value=min_purchase_value
    )


@router.get("/admin", response_model=schemas.PopupAdminResponse)
def get_admin_popup(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Retorna os dados completos de configuração do pop-up para o painel admin."""
    popup = db.query(models.PromotionalPopup).first()
    if not popup:
        return schemas.PopupAdminResponse(
            id=None,
            is_active=False,
            title="Oferta Especial Ecosopis 🌿",
            description="Aproveite um desconto exclusivo para cuidar da sua pele com o melhor da natureza.",
            image_url=None,
            button_text="Aproveitar Desconto",
            button_link="/produtos",
            frequency="once_per_session",
            delay_seconds=3,
            has_coupon=False,
            coupon_code=None,
            coupon_discount_type="percentage",
            coupon_discount_value=10.0,
            coupon_min_purchase_value=0.0,
            coupon_valid_until=None,
            coupon_usage_limit=None,
            coupon_is_active=True
        )

    coupon = None
    if popup.coupon_id:
        coupon = db.query(models.Coupon).filter(models.Coupon.id == popup.coupon_id).first()

    return schemas.PopupAdminResponse(
        id=popup.id,
        is_active=popup.is_active,
        title=popup.title,
        description=popup.description or "",
        image_url=popup.image_url,
        button_text=popup.button_text or "Aproveitar Desconto",
        button_link=popup.button_link or "/produtos",
        frequency=popup.frequency or "once_per_session",
        delay_seconds=popup.delay_seconds if popup.delay_seconds is not None else 3,
        has_coupon=bool(coupon or popup.coupon_code),
        coupon_code=coupon.code if coupon else popup.coupon_code,
        coupon_discount_type=coupon.discount_type if coupon else "percentage",
        coupon_discount_value=coupon.discount_value if coupon else 10.0,
        coupon_min_purchase_value=coupon.min_purchase_value if coupon else 0.0,
        coupon_valid_until=coupon.valid_until if coupon else None,
        coupon_usage_limit=coupon.usage_limit if coupon else None,
        coupon_is_active=coupon.is_active if coupon else True
    )


@router.put("/admin", response_model=schemas.PopupAdminResponse)
def save_admin_popup(
    payload: schemas.PopupAdminSaveRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """
    Salva ou atualiza a configuração do pop-up promocional e sincroniza
    automaticamente com a tabela existente de cupons (models.Coupon).
    """
    popup = db.query(models.PromotionalPopup).first()
    if not popup:
        popup = models.PromotionalPopup()
        db.add(popup)

    popup.is_active = payload.is_active
    popup.title = payload.title
    popup.description = payload.description or ""
    popup.image_url = payload.image_url
    popup.button_text = payload.button_text or "Aproveitar Desconto"
    popup.button_link = payload.button_link or "/produtos"
    popup.frequency = payload.frequency or "once_per_session"
    popup.delay_seconds = payload.delay_seconds if payload.delay_seconds is not None else 3

    # Sincronização com o sistema existente de cupons
    coupon_obj = None
    if payload.has_coupon and payload.coupon_code and payload.coupon_code.strip():
        code = payload.coupon_code.strip().upper()
        # Busca cupom existente com o mesmo código
        coupon_obj = db.query(models.Coupon).filter(models.Coupon.code == code).first()

        if coupon_obj:
            # Atualiza cupom existente
            coupon_obj.discount_type = payload.coupon_discount_type or "percentage"
            coupon_obj.discount_value = float(payload.coupon_discount_value or 0.0)
            coupon_obj.min_purchase_value = float(payload.coupon_min_purchase_value or 0.0)
            coupon_obj.valid_until = payload.coupon_valid_until
            coupon_obj.usage_limit = payload.coupon_usage_limit
            coupon_obj.is_active = payload.coupon_is_active if payload.coupon_is_active is not None else True
        else:
            # Cria novo cupom no sistema oficial de cupons
            coupon_obj = models.Coupon(
                code=code,
                discount_type=payload.coupon_discount_type or "percentage",
                discount_value=float(payload.coupon_discount_value or 0.0),
                min_purchase_value=float(payload.coupon_min_purchase_value or 0.0),
                valid_until=payload.coupon_valid_until,
                usage_limit=payload.coupon_usage_limit,
                is_active=payload.coupon_is_active if payload.coupon_is_active is not None else True
            )
            db.add(coupon_obj)
            db.flush()

        popup.coupon_id = coupon_obj.id
        popup.coupon_code = coupon_obj.code
    else:
        # Se desativou o cupom da promoção
        popup.coupon_id = None
        popup.coupon_code = None

    db.commit()
    db.refresh(popup)

    return schemas.PopupAdminResponse(
        id=popup.id,
        is_active=popup.is_active,
        title=popup.title,
        description=popup.description or "",
        image_url=popup.image_url,
        button_text=popup.button_text,
        button_link=popup.button_link,
        frequency=popup.frequency,
        delay_seconds=popup.delay_seconds,
        has_coupon=bool(coupon_obj),
        coupon_code=coupon_obj.code if coupon_obj else None,
        coupon_discount_type=coupon_obj.discount_type if coupon_obj else "percentage",
        coupon_discount_value=coupon_obj.discount_value if coupon_obj else 0.0,
        coupon_min_purchase_value=coupon_obj.min_purchase_value if coupon_obj else 0.0,
        coupon_valid_until=coupon_obj.valid_until if coupon_obj else None,
        coupon_usage_limit=coupon_obj.usage_limit if coupon_obj else None,
        coupon_is_active=coupon_obj.is_active if coupon_obj else True
    )


@router.get("/recipients-count")
def get_recipients_count(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Retorna o total de clientes cadastrados com e-mail válido para a campanha."""
    emails_list = _get_valid_unique_user_emails(db)
    return {"recipient_count": len(emails_list)}


@router.post("/dispatch-email")
def dispatch_campaign_email(
    payload: schemas.CampaignEmailDispatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """
    Registra e dispara a campanha de e-mail promocional em segundo plano
    para todos os usuários cadastrados com e-mails válidos e sem duplicidade.
    """
    recipient_emails = _get_valid_unique_user_emails(db)

    if not recipient_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum cliente cadastrado com e-mail válido foi encontrado no sistema."
        )

    # Cria registro no histórico de campanhas
    log_entry = models.CampaignDispatchLog(
        promotion_title=payload.email_title,
        coupon_code=payload.coupon_code,
        recipient_count=len(recipient_emails),
        admin_email=admin.email,
        status="in_progress"
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    # Agenda execução em background
    background_tasks.add_task(
        _dispatch_campaign_in_background,
        log_id=log_entry.id,
        recipient_emails=recipient_emails,
        subject=payload.email_subject,
        title=payload.email_title,
        body=payload.email_body,
        image_url=payload.email_image_url,
        coupon_code=payload.coupon_code,
        discount_info=payload.discount_info,
        button_text=payload.button_text,
        button_link=payload.button_link
    )

    return {
        "message": f"Campanha iniciada com sucesso para {len(recipient_emails)} clientes.",
        "recipient_count": len(recipient_emails),
        "log_id": log_entry.id
    }


@router.get("/dispatch-logs", response_model=List[schemas.CampaignDispatchLogResponse])
def get_dispatch_logs(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Retorna os últimos disparos de campanhas promocionais."""
    return db.query(models.CampaignDispatchLog).order_by(models.CampaignDispatchLog.id.desc()).limit(20).all()
