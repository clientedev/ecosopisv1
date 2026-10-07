import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.endpoints.auth import get_current_user, get_current_user_optional
from app.repositories.order_repository import OrderRepository
from app.core.stripe_service import create_checkout_session, verify_webhook_signature, get_session
from app.core.mercadopago_service import create_checkout_pro_preference, get_payment_status as get_mp_payment_status
from app.services.melhorenvio_service import processar_envio
from app.models import models
from app.models.pedido import Pedido
from app.core import emails
from app.api.endpoints.cashback import create_cashback_for_order

logger = logging.getLogger(__name__)

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "")

# ── Pydantic schemas ─────────────────────────────────────────────────────────
class CheckoutItemIn(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float


class CreateCheckoutIn(BaseModel):
    order_id: Optional[int] = None
    items: List[CheckoutItemIn]
    total: float
    address: Optional[Dict[str, Any]] = None
    shipping_method: Optional[str] = "fixo"
    shipping_service_id: Optional[int] = None
    shipping_price: Optional[float] = 20.0
    coupon_code: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_cpf: Optional[str] = None
    discount_amount: Optional[float] = 0.0
    cashback_amount: Optional[float] = 0.0


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: Optional[str] = None
    preference_id: Optional[str] = None
    order_id: int


class StatusUpdateIn(BaseModel):
    status: str


class ProcessCardIn(BaseModel):
    order_data: CreateCheckoutIn
    token: str
    installments: int = 1
    payment_method_id: str
    issuer_id: Optional[str] = None
    device_id: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalize_url(url: str) -> str:
    url = url.strip().rstrip("/")
    if not url:
        return "http://localhost:3000"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://{url}"

def _resolve_frontend_url(request: Request) -> str:
    if FRONTEND_URL:
        return _normalize_url(FRONTEND_URL)
    origin = request.headers.get("origin")
    if origin and "localhost" not in origin:
        return _normalize_url(origin)
    return "http://localhost:3000"


def _translate_mp_status_detail(detail: str) -> str:
    messages = {
        "cc_rejected_bad_filled_card_number": "Número do cartão incorreto.",
        "cc_rejected_bad_filled_date": "Data de validade incorreta.",
        "cc_rejected_bad_filled_security_code": "Código de segurança (CVV) inválido.",
        "cc_rejected_bad_filled_other": "Dados do cartão preenchidos incorretamente.",
        "cc_rejected_insufficient_amount": "Saldo ou limite insuficiente no cartão.",
        "cc_rejected_call_for_authorize": "Pagamento não autorizado. Por favor, ligue para o emissor do cartão para liberar.",
        "cc_rejected_card_disabled": "Cartão bloqueado ou desativado. Entre em contato com seu banco.",
        "cc_rejected_duplicated_payment": "Pagamento duplicado detectado para esta compra.",
        "cc_rejected_high_risk": "Pagamento recusado pela análise de segurança e antifraude.",
        "cc_rejected_max_attempts": "Limite de tentativas excedido. Tente novamente mais tarde.",
        "cc_rejected_blacklist": "Não foi possível processar o pagamento com este cartão.",
    }
    return messages.get(detail, "O pagamento com cartão foi recusado. Verifique os dados ou utilize outro método.")


def _validate_and_calculate_order(data: CreateCheckoutIn, current_user: models.User, db: Session) -> dict:
    """
    Strict server-side validation of products, active stock, coupon codes,
    cashback deductions, shipping discounts, and CPF.
    NEVER trusts client-provided totals.
    """
    if not data.items:
        raise HTTPException(status_code=400, detail="O carrinho está vazio.")

    # 1. CPF Validation
    clean_cpf = "".join(filter(str.isdigit, data.customer_cpf or ""))
    if not clean_cpf or len(clean_cpf) != 11:
        raise HTTPException(status_code=400, detail="Por favor, forneça um CPF válido com 11 dígitos.")
    from app.core.mercadopago_service import is_valid_cpf
    if not is_valid_cpf(clean_cpf):
        raise HTTPException(status_code=400, detail="O CPF informado é inválido. Por favor, confira os números digitados.")
    data.customer_cpf = clean_cpf

    # 2. Wholesale detection
    has_wholesale_items = any("(Atacado)" in (item.product_name or "") for item in data.items)

    # 3. Item & Stock verification
    subtotal = 0.0
    for item in data.items:
        prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Produto ID {item.product_id} não encontrado.")
        if not prod.is_active or not prod.buy_on_site:
            raise HTTPException(status_code=400, detail=f"O produto '{prod.name}' não está disponível para compra no momento.")
        if prod.stock is not None and prod.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente para '{prod.name}'. Disponível: {prod.stock}, solicitado: {item.quantity}."
            )

        is_item_wholesale = "(Atacado)" in (item.product_name or "") or bool(prod.is_wholesale)
        if is_item_wholesale:
            verified_price = round(float(prod.price or 0.0) * 0.7, 2)
        elif prod.is_on_sale and prod.sale_price:
            verified_price = round(float(prod.sale_price), 2)
        else:
            verified_price = round(float(prod.price or 0.0), 2)

        item.price = verified_price
        subtotal += verified_price * int(item.quantity)

    subtotal = round(subtotal, 2)

    # 4. Coupon verification
    discount_amount = 0.0
    if data.coupon_code and not has_wholesale_items:
        code_clean = data.coupon_code.strip().upper()
        if code_clean == "PRIMEIRACOMPRA":
            if (current_user.total_compras or 0) == 0:
                discount_amount = round(subtotal * 0.10, 2)
            else:
                data.coupon_code = None
        else:
            coupon = db.query(models.Coupon).filter(
                models.Coupon.code == code_clean,
                models.Coupon.is_active == True
            ).first()
            if coupon:
                now_utc = datetime.now(timezone.utc)
                is_valid = True
                if coupon.valid_until and coupon.valid_until < now_utc:
                    is_valid = False
                if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
                    is_valid = False
                if coupon.min_purchase_value and subtotal < coupon.min_purchase_value:
                    is_valid = False

                if is_valid:
                    if coupon.discount_type == "percentage":
                        discount_amount = round(subtotal * (coupon.discount_value / 100.0), 2)
                    elif coupon.discount_type == "fixed":
                        discount_amount = min(subtotal, round(float(coupon.discount_value), 2))
                else:
                    data.coupon_code = None
            else:
                data.coupon_code = None
    elif has_wholesale_items:
        data.coupon_code = None
        discount_amount = 0.0

    data.discount_amount = discount_amount

    # 5. Cashback verification
    cashback_discount = 0.0
    if (data.cashback_amount or 0) > 0:
        from app.api.endpoints.cashback import _available_balance
        avail_cashback = _available_balance(db, current_user.id)
        max_possible = max(0.0, round(subtotal - discount_amount, 2))
        cashback_discount = min(avail_cashback, max_possible, float(data.cashback_amount))
    data.cashback_amount = round(cashback_discount, 2)

    # 6. Shipping verification & Free Shipping threshold check
    shipping_price = float(data.shipping_price or 0.0)
    addr_zip = (data.address or {}).get("postal_code", "") or (data.address or {}).get("zip", "")
    clean_cep = "".join(filter(str.isdigit, addr_zip))
    if len(clean_cep) == 8:
        prefix = int(clean_cep[:2])
        is_sul_sudeste = (1 <= prefix <= 39) or (80 <= prefix <= 99)
        threshold = 148.90 if is_sul_sudeste else 248.90
        is_free_coupon = (data.coupon_code and db.query(models.Coupon).filter(models.Coupon.code == data.coupon_code.upper(), models.Coupon.discount_type == "free_shipping").first())
        if subtotal >= threshold or is_free_coupon:
            shipping_price = 0.0
    data.shipping_price = round(shipping_price, 2)

    # 7. Final total server calculation
    final_total = max(0.01, round(subtotal + shipping_price - discount_amount - cashback_discount, 2))
    data.total = final_total

    return {
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "cashback_amount": cashback_discount,
        "shipping_price": shipping_price,
        "final_total": final_total,
    }


def _resolve_or_create_user(data: CreateCheckoutIn, current_user: Optional[models.User], db: Session) -> models.User:
    if current_user:
        return current_user
    buyer_email = (
        data.customer_email
        or (data.address or {}).get("email")
        or (data.address or {}).get("customer_email")
        or "cliente@ecosopis.com.br"
    ).strip().lower()

    user = db.query(models.User).filter(models.User.email == buyer_email).first()
    if not user:
        user = models.User(
            email=buyer_email,
            full_name=data.customer_name or "Cliente",
            phone=data.customer_phone or "",
            role="client",
            is_verified=True,
            hashed_password=""
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _get_or_create_order(data: CreateCheckoutIn, current_user: models.User, db: Session, payment_method: str) -> models.Order:
    repo = OrderRepository(db)
    if any("(Atacado)" in (item.product_name or "") for item in data.items):
        data.coupon_code = ""
        data.discount_amount = 0.0

    if data.order_id:
        order = repo.get_order_by_id(data.order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
        order.payment_method = payment_method
        order.total = data.total
        order.shipping_price = data.shipping_price or 0.0
        order.shipping_method = data.shipping_method or "fixo"
        if data.shipping_service_id is not None:
            order.shipping_service_id = int(data.shipping_service_id)
        order.coupon_code = data.coupon_code or ""
        order.discount_amount = data.discount_amount or 0.0
        order.customer_cpf = data.customer_cpf
        if data.customer_name: order.customer_name = data.customer_name
        if data.customer_phone: order.customer_phone = data.customer_phone
        if data.address: order.address = data.address
    else:
        order = repo.create_order(
            user_id=current_user.id,
            total=data.total,
            shipping_price=data.shipping_price or 0.0,
            shipping_method=data.shipping_method or "fixo",
            items=[item.dict() for item in data.items],
            address=data.address or {},
            status="pending",
            coupon_code=data.coupon_code or "",
            discount_amount=data.discount_amount or 0.0,
            customer_cpf=data.customer_cpf
        )
        repo.add_order_items(order.id, [item.dict() for item in data.items])
        
        if data.shipping_service_id is not None:
            order.shipping_service_id = int(data.shipping_service_id)
        order.payment_method = payment_method
        order.customer_name = data.customer_name or current_user.full_name or ""
        order.customer_email = current_user.email
        order.customer_phone = data.customer_phone or ""
        
        # Clear saved cart JSON upon checkout creation
        current_user.cart_json = None
        current_user.cart_updated_at = None

    db.commit()
    db.refresh(order)
    return order


def finalize_order_on_payment(order: models.Order, db: Session, payment_id: str = None, session_id: str = None, buyer_email: str = None, buyer_name: str = None):
    """
    Shared logic to handle successful payment:
    1. Mark order as paid atomically (Idempotency guaranteed).
    2. Deduct product stock.
    3. Update buyer info.
    4. Update user metrics (total purchases, roulette).
    5. Process Cashback.
    6. GENERATE SHIPPING LABEL / Cart Entry (Melhor Envio).
    7. Send Confirmation Emails (Customer + contato@ecosopis.com.br).
    8. Send WhatsApp Notification to Julia (11951559212) & Customer.
    """
    try:
        db.refresh(order)
    except Exception as ref_err:
        logger.warning(f"Could not refresh order {order.id} state from DB: {ref_err}")

    # Re-read status from the refreshed object to avoid race conditions
    # where another webhook call already finalized this order concurrently.
    if order.status in ("paid", "shipped", "delivered", "processando_envio", "erro_envio", "PROCESSANDO_ENVIO", "ERRO_ENVIO"):
        logger.info(f"Order {order.id} already in status '{order.status}'. Skipping finalize.")
        return

    # Atomic DB update to prevent race conditions across parallel webhooks
    rows_updated = db.query(models.Order).filter(
        models.Order.id == order.id,
        ~models.Order.status.in_(["paid", "shipped", "delivered", "processando_envio", "erro_envio", "PROCESSANDO_ENVIO", "ERRO_ENVIO"])
    ).update({
        "status": "paid",
        "mercadopago_payment_id": payment_id if payment_id and order.payment_method != "stripe" else models.Order.mercadopago_payment_id,
        "stripe_payment_id": payment_id if payment_id and order.payment_method == "stripe" else models.Order.stripe_payment_id,
        "stripe_session_id": session_id or models.Order.stripe_session_id,
        "buyer_email": buyer_email or models.Order.buyer_email,
        "buyer_name": buyer_name or models.Order.buyer_name,
    }, synchronize_session="fetch")

    if rows_updated == 0:
        db.refresh(order)
        logger.info(f"Order {order.id} was already finalized concurrently. Skipping duplicate.")
        return

    # Deduct product stock safely
    try:
        items_data = order.items or []
        for it in items_data:
            pid = it.get("product_id") or it.get("id")
            qty = it.get("quantity") or 1
            if pid:
                prod = db.query(models.Product).filter(models.Product.id == int(pid)).first()
                if prod and prod.stock is not None:
                    prod.stock = max(0, int(prod.stock) - int(qty))
    except Exception as stock_err:
        logger.warning(f"Error updating stock for order {order.id}: {stock_err}")

    # Update user metrics
    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user:
        user.total_compras = (user.total_compras or 0) + 1
        user.cart_json = None
        user.cart_updated_at = None
        
        # Cashback logic
        try:
            create_cashback_for_order(db, order, user)
        except Exception as e:
            logger.error(f"Error processing cashback for order {order.id}: {e}")

    db.commit()
    logger.info(f"Order {order.id} status updated to PAID via {order.payment_method}")

    # ── LOGISTICS: MELHOR ENVIO ──────────────────────────────────────────────
    # O envio para o Melhor Envio NÃO é feito automaticamente no pagamento.
    # O envio só é adicionado ao carrinho quando o administrador clicar explicitamente
    # em "Gerar Etiqueta" no painel de pedidos, onde poderá conferir a embalagem e
    # decidir no painel do Melhor Envio se compra ou não.
    logger.info(f"Order {order.id} marked as PAID. Shipment will be sent to Melhor Envio only when admin clicks 'Gerar' in admin panel.")

    # ── EMAIL NOTIFICATIONS ──────────────────────────────────────────────────
    try:
        items_data = order.items or []
        if not items_data and order.order_items:
            items_data = [{"name": item.product.name, "quantity": item.quantity, "price": item.price} for item in order.order_items]
        
        # 1. E-mail de confirmação para o comprador
        buyer_dest_email = order.buyer_email or order.customer_email or (user.email if user else None)
        if buyer_dest_email:
            emails.send_order_confirmation_email(
                email=buyer_dest_email,
                order_id=order.id,
                items=items_data,
                total=order.total
            )
        
        # 2. E-mail de notificação para contato@ecosopis.com.br (Garantido sempre)
        emails.send_admin_notification_email(
            admin_email="contato@ecosopis.com.br",
            order_id=order.id,
            total=order.total,
            customer_name=order.buyer_name or order.customer_name or "Cliente",
            order=order
        )

        # Se houver outro admin_email configurado no banco, notifica também
        admin_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "admin_order_notification_email").first()
        if admin_setting and admin_setting.value and admin_setting.value.lower() != "contato@ecosopis.com.br":
            emails.send_admin_notification_email(
                admin_email=admin_setting.value,
                order_id=order.id,
                total=order.total,
                customer_name=order.buyer_name or order.customer_name or "Cliente",
                order=order
            )
    except Exception as e:
        logger.error(f"Error sending confirmation emails for order {order.id}: {e}")

    # ── WHATSAPP NOTIFICATIONS (JÚLIA 11951559212 + CLIENTE) ────────────────
    try:
        from app.services.whatsapp import notify_julia_new_order, trigger_whatsapp_event
        # 1. Notifica Júlia imediatamente no WhatsApp (11951559212)
        notify_julia_new_order(order, db)

        # 2. Notifica o cliente se houver telefone cadastrado
        customer_phone = order.customer_phone or (user.phone if user else None)
        if customer_phone:
            client_name = order.customer_name or order.buyer_name or (user.full_name if user else "Cliente")
            items_names = [it.get("name") or it.get("product_name") for it in (order.items or []) if it]
            items_str = ", ".join(filter(None, items_names)) or "Cosméticos ECOSOPIS"
            
            context = {
                "cliente": client_name,
                "pedido": order.id,
                "valor": f"{order.total:.2f}".replace(".", ","),
                "itens": items_str,
                "codigo_rastreio": order.codigo_rastreio or "Em breve"
            }
            trigger_whatsapp_event("order_paid", customer_phone, context, db, recipient_name=client_name)
    except Exception as wa_err:
        logger.error(f"Error triggering WhatsApp notifications for order {order.id}: {wa_err}")



# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/create-stripe-checkout", response_model=CheckoutResponse)
@router.post("/create-payment", include_in_schema=False)
async def create_stripe_payment(
    data: CreateCheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        order = _get_or_create_order(data, current_user, db, "stripe")
        frontend_url = _resolve_frontend_url(request)

        items_for_stripe = [item.dict() for item in data.items]
        result = create_checkout_session(
            order_id=order.id,
            items=items_for_stripe,
            shipping_price=order.shipping_price,
            frontend_url=frontend_url,
        )
        order.stripe_session_id = result["session_id"]
        db.commit()

        return CheckoutResponse(
            checkout_url=result["checkout_url"],
            session_id=result["session_id"],
            order_id=order.id,
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Erro no checkout Stripe: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"ERRO TÉCNICO STRIPE: {str(e)}"
        )


@router.post("/create-mercadopago-checkout", response_model=CheckoutResponse)
@router.post("/create-preference", include_in_schema=False)
async def create_mp_payment(
    data: CreateCheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    try:
        current_user = _resolve_or_create_user(data, current_user, db)
        order = _get_or_create_order(data, current_user, db, "mercadopago")
        
        items_for_mp = [item.dict() for item in data.items]
        preference = create_checkout_pro_preference(
            order_id=order.id,
            items=items_for_mp,
            shipping_price=order.shipping_price,
            customer_email=data.customer_email or current_user.email,
            customer_name=data.customer_name or current_user.full_name or "Cliente",
            customer_cpf=order.customer_cpf,
            discount_amount=(data.discount_amount or 0.0) + (data.cashback_amount or 0.0)
        )
        
        order.mercadopago_preference_id = preference["id"]
        db.commit()

        return CheckoutResponse(
            checkout_url=preference["init_point"],
            preference_id=preference["id"],
            order_id=order.id,
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Erro no checkout Mercado Pago: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"ERRO TÉCNICO MP: {str(e)}"
        )


@router.get("/config")
async def get_payment_config():
    """
    Returns public payment gateway configuration and feature flag status.
    """
    transparent_enabled = os.getenv("MP_TRANSPARENT_CHECKOUT_ENABLED", "true").lower() in ("true", "1", "yes")
    mp_public_key = (os.getenv("MP_PUBLIC_KEY") or os.getenv("NEXT_PUBLIC_MP_PUBLIC_KEY") or "").strip()

    return {
        "transparent_checkout_enabled": transparent_enabled,
        "mp_public_key": mp_public_key,
        "max_free_installments": int(os.getenv("MP_MAX_FREE_INSTALLMENTS", "3")),
    }


@router.post("/process-transparent-pix")
async def process_transparent_pix(
    data: CreateCheckoutIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """
    Creates and processes a transparent PIX payment on Mercado Pago directly within Ecosopis.
    Validates items, stock, coupons, cashback, shipping, CPF, and strictly calculates final total.
    """
    try:
        current_user = _resolve_or_create_user(data, current_user, db)

        # Validate order and calculate authoritative server-side totals
        _validate_and_calculate_order(data, current_user, db)

        # Create or update order in DB
        order = _get_or_create_order(data, current_user, db, payment_method="mercadopago_pix")

        # Invoke Mercado Pago PIX generation
        from app.core.mercadopago_service import create_pix_payment
        items_for_mp = [item.dict() for item in data.items]

        pix_result = create_pix_payment(
            order_id=order.id,
            total=order.total,
            customer_email=data.customer_email or current_user.email,
            customer_name=data.customer_name or order.customer_name or current_user.full_name or "Cliente",
            items=items_for_mp,
            customer_cpf=order.customer_cpf
        )

        order.mercadopago_payment_id = pix_result.get("payment_id")
        db.commit()
        db.refresh(order)

        return {
            "order_id": order.id,
            "payment_id": pix_result.get("payment_id"),
            "status": pix_result.get("status", "pending"),
            "status_detail": pix_result.get("status_detail", ""),
            "qr_code": pix_result.get("qr_code"),
            "qr_code_base64": pix_result.get("qr_code_base64"),
            "ticket_url": pix_result.get("ticket_url"),
            "total": order.total,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao processar PIX transparente: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PIX: {str(e)}")


@router.post("/process-transparent-card")
async def process_transparent_card(
    payload: ProcessCardIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """
    Processes a credit/debit card payment using client-tokenized card on Mercado Pago.
    Does NOT receive, store, or log sensitive card numbers or CVV.
    Supports Device ID for anti-fraud validation.
    """
    try:
        current_user = _resolve_or_create_user(payload.order_data, current_user, db)

        # Validate token
        if not payload.token or not payload.token.strip():
            raise HTTPException(status_code=400, detail="Token do cartão não fornecido.")

        # Validate order and calculate authoritative server-side totals
        _validate_and_calculate_order(payload.order_data, current_user, db)

        # Create or update order in DB
        order = _get_or_create_order(payload.order_data, current_user, db, payment_method="mercadopago_card")

        from app.core.mercadopago_service import create_card_payment

        card_result = create_card_payment(
            order_id=order.id,
            total=order.total,
            token=payload.token.strip(),
            installments=payload.installments,
            payment_method_id=payload.payment_method_id,
            customer_email=payload.order_data.customer_email or current_user.email,
            customer_name=payload.order_data.customer_name or order.customer_name or current_user.full_name or "Cliente",
            customer_cpf=order.customer_cpf,
            issuer_id=payload.issuer_id,
            device_id=payload.device_id,
        )

        order.mercadopago_payment_id = card_result.get("payment_id")
        mp_status = card_result.get("status")
        mp_detail = card_result.get("status_detail", "")

        if mp_status in ["approved", "authorized"]:
            finalize_order_on_payment(
                order=order,
                db=db,
                payment_id=card_result.get("payment_id"),
                buyer_email=current_user.email,
                buyer_name=order.customer_name
            )
            db.commit()
            return {
                "order_id": order.id,
                "payment_id": card_result.get("payment_id"),
                "status": "approved",
                "status_detail": mp_detail,
                "total": order.total,
            }
        elif mp_status in ["in_process", "pending"]:
            db.commit()
            return {
                "order_id": order.id,
                "payment_id": card_result.get("payment_id"),
                "status": "in_process",
                "status_detail": mp_detail,
                "total": order.total,
                "message": "Pagamento em análise pelo Mercado Pago."
            }
        else:
            db.commit()
            user_msg = _translate_mp_status_detail(mp_detail)
            return {
                "order_id": order.id,
                "payment_id": card_result.get("payment_id"),
                "status": mp_status or "rejected",
                "status_detail": mp_detail,
                "detail": user_msg,
            }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao processar cartão transparente: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar pagamento com cartão: {str(e)}")


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = verify_webhook_signature(payload, sig_header)
    except Exception as e:
        logger.error(f"Stripe Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] in ["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"]:
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        pedido_id = metadata.get("pedido_id")
        
        if pedido_id:
            order = db.query(models.Order).filter(models.Order.id == int(pedido_id)).first()
            if order:
                cust_det = session.get("customer_details") or {}
                finalize_order_on_payment(
                    order=order, 
                    db=db, 
                    payment_id=session.get("payment_intent"),
                    session_id=session.get("id"),
                    buyer_email=cust_det.get("email"),
                    buyer_name=cust_det.get("name")
                )
    return {"status": "ok"}


@router.get("/webhook/mercadopago")
@router.get("/api/payment/webhook/mercadopago")
@router.get("/payment/webhook/mercadopago")
async def mercadopago_webhook_health():
    """Healthcheck e validação de URL de notificação do Mercado Pago."""
    return {"status": "online", "service": "Mercado Pago Webhook ECOSOPIS"}


def _handle_external_mp_payment(payment_info: dict, resource_id: str, db: Session) -> Optional[models.Order]:
    """
    Quando um pagamento é aprovado no Mercado Pago (ex: venda realizada no Mercado Livre,
    checkout avulso ou link direto) e não possui um pedido prévio no site, cria o pedido
    automaticamente com status 'paid' para que o lojista veja a venda em /admin/pedidos.
    """
    try:
        existing = db.query(models.Order).filter(
            models.Order.mercadopago_payment_id == str(resource_id)
        ).first()
        if existing:
            logger.info(f"External MP payment {resource_id} already registered as order #{existing.id}")
            return existing

        desc = payment_info.get("description") or "Venda Mercado Livre / Mercado Pago"
        mp_order_obj = payment_info.get("order") or {}
        order_type = str(mp_order_obj.get("type", "")).lower()
        is_meli = (
            order_type == "mercadolibre" 
            or "mercado livre" in desc.lower() 
            or "mercadolivre" in desc.lower()
        )
        
        channel = "mercadolivre" if is_meli else "mercadopago"
        shipping_method = "Mercado Envios" if is_meli else "A Combinar"

        payer_info = payment_info.get("payer") or {}
        buyer_email = payer_info.get("email") or "comprador@mercadolivre.com"
        first_n = payer_info.get("first_name") or ""
        last_n = payer_info.get("last_name") or ""
        buyer_name = f"{first_n} {last_n}".strip() or (
            "Comprador Mercado Livre" if is_meli else "Cliente Mercado Pago"
        )
        ident = payer_info.get("identification") or {}
        customer_cpf = ident.get("number")

        amount = float(payment_info.get("transaction_amount") or 0.0)

        additional_info = payment_info.get("additional_info") or {}
        raw_items = additional_info.get("items") or []
        items_json = []
        if raw_items:
            for it in raw_items:
                items_json.append({
                    "product_id": 1,
                    "product_name": it.get("title") or desc,
                    "quantity": int(it.get("quantity") or 1),
                    "price": float(it.get("unit_price") or amount)
                })
        else:
            items_json.append({
                "product_id": 1,
                "product_name": desc,
                "quantity": 1,
                "price": amount
            })

        ship_info = additional_info.get("shipments") or {}
        receiver_addr = ship_info.get("receiver_address") or {}
        address_json = {
            "street": receiver_addr.get("street_name") or ("Envio via Mercado Envios" if is_meli else "Endereço não informado"),
            "number": str(receiver_addr.get("street_number") or "S/N"),
            "neighborhood": "Mercado Livre" if is_meli else "Balcão",
            "city": receiver_addr.get("city_name") or "Consulte etiqueta no painel ML",
            "state": receiver_addr.get("state_name") or "BR",
            "postal_code": receiver_addr.get("zip_code") or "00000-000",
            "observacao": "Venda externa. Etiqueta gerada diretamente pelo Mercado Envios." if is_meli else "Venda direta via Mercado Pago"
        }

        admin_user = db.query(models.User).filter(models.User.role == "admin").first()
        user_id = admin_user.id if admin_user else 1

        new_order = models.Order(
            user_id=user_id,
            status="paid",
            total=amount,
            shipping_price=0.0,
            shipping_method=shipping_method,
            items=items_json,
            address=address_json,
            payment_method=channel,
            mercadopago_payment_id=str(resource_id),
            customer_name=buyer_name,
            customer_email=buyer_email,
            customer_cpf=customer_cpf,
            buyer_name=buyer_name,
            buyer_email=buyer_email
        )
        db.add(new_order)
        db.flush()

        for itm in items_json:
            try:
                oi = models.OrderItem(
                    order_id=new_order.id,
                    product_id=itm.get("product_id") or 1,
                    quantity=itm.get("quantity") or 1,
                    price=float(itm.get("price") or 0.0)
                )
                db.add(oi)
            except Exception:
                pass

        db.commit()
        db.refresh(new_order)
        logger.info(f"✓ Pedido #{new_order.id} criado automaticamente para pagamento externo MP/ML {resource_id}")
        return new_order
    except Exception as err:
        logger.error(f"Erro ao criar pedido para pagamento externo {resource_id}: {err}", exc_info=True)
        return None


@router.post("/webhook/mercadopago")
@router.post("/api/payment/webhook/mercadopago")
@router.post("/payment/webhook/mercadopago")
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives notification from Mercado Pago (topic: merchant_order or payment).
    Handles JSON payloads (Webhooks v2), Form URL Encoded payloads (IPN), and Query Parameters.
    Automatically finalizes order as 'paid', triggers emails and WhatsApp alerts.
    Also captures external payments (e.g. from Mercado Livre sales) and registers them as orders.
    """
    data = {}
    try:
        data = await request.json()
        if not isinstance(data, dict):
            data = {}
    except Exception:
        try:
            form_data = await request.form()
            data = dict(form_data)
        except Exception:
            data = {}

    if not data:
        data = dict(request.query_params)

    logger.info(f"MP Webhook received. Data: {data}, Query: {dict(request.query_params)}")

    # Extract resource ID safely without crashing on null nested fields
    data_obj = data.get("data")
    data_id = data_obj.get("id") if isinstance(data_obj, dict) else None

    resource_id = (
        data_id or 
        data.get("id") or 
        data.get("resource") or
        request.query_params.get("data.id") or 
        request.query_params.get("id") or
        request.query_params.get("resource")
    )
    topic = (
        data.get("type") or 
        data.get("topic") or 
        request.query_params.get("type") or 
        request.query_params.get("topic")
    )
    
    action = data.get("action") or request.query_params.get("action")
    if action and isinstance(action, str):
        if action.startswith("payment."):
            topic = "payment"
        elif action.startswith("merchant_order."):
            topic = "merchant_order"

    if not topic and resource_id:
        topic = "payment"

    if topic in ("payment", "collection") and resource_id:
        try:
            payment_info = get_mp_payment_status(str(resource_id))
            if payment_info.get("status") in ["approved", "authorized"]:
                pedido_id = payment_info.get("external_reference")
                order = None
                if pedido_id:
                    try:
                        order_id_int = int(pedido_id)
                        order = db.query(models.Order).filter(models.Order.id == order_id_int).first()
                    except ValueError:
                        logger.error(f"Invalid external_reference (not an int): {pedido_id}")
                
                # Fallback: se não achou por external_reference, busca por payment_id ou preference_id
                if not order and resource_id:
                    order = db.query(models.Order).filter(models.Order.mercadopago_payment_id == str(resource_id)).first()
                if not order and payment_info.get("preference_id"):
                    order = db.query(models.Order).filter(models.Order.mercadopago_preference_id == str(payment_info["preference_id"])).first()

                if order:
                    finalize_order_on_payment(
                        order=order,
                        db=db,
                        payment_id=str(resource_id),
                        buyer_email=payment_info.get("payer", {}).get("email")
                    )
                    logger.info(f"MP Payment {resource_id} successfully processed for order {order.id}")
                else:
                    logger.info(f"Order not found for MP Payment {resource_id} (ext_ref: {pedido_id}). Capturing as external payment...")
                    _handle_external_mp_payment(payment_info, str(resource_id), db)
        except Exception as e:
            logger.error(f"Error processing MP payment {resource_id}: {e}", exc_info=True)
            
    elif topic == "merchant_order" and resource_id:
        try:
            from app.core.mercadopago_service import sdk as mp_sdk
            result = mp_sdk.merchant_order().get(str(resource_id))
            if result.get("status") in [200, 201]:
                order_info = result.get("response", {})
                payments = order_info.get("payments", [])
                
                has_approved_payment = False
                approved_payment_id = None
                
                for p in payments:
                    if p.get("status") in ["approved", "authorized"]:
                        has_approved_payment = True
                        approved_payment_id = str(p.get("id"))
                        break
                
                if has_approved_payment:
                    pedido_id = order_info.get("external_reference")
                    order = None
                    if pedido_id:
                        try:
                            order_id_int = int(pedido_id)
                            order = db.query(models.Order).filter(models.Order.id == order_id_int).first()
                        except ValueError:
                            logger.error(f"Invalid external_reference in merchant_order (not an int): {pedido_id}")
                    
                    if not order and approved_payment_id:
                        order = db.query(models.Order).filter(models.Order.mercadopago_payment_id == approved_payment_id).first()
                    if not order and order_info.get("preference_id"):
                        order = db.query(models.Order).filter(models.Order.mercadopago_preference_id == str(order_info["preference_id"])).first()

                    if order:
                        payer_info = order_info.get("payer", {})
                        buyer_email = payer_info.get("email")
                        finalize_order_on_payment(
                            order=order,
                            db=db,
                            payment_id=approved_payment_id,
                            buyer_email=buyer_email
                        )
                        logger.info(f"MP Merchant Order {resource_id} successfully processed for order {order.id}")
                    elif approved_payment_id:
                        try:
                            payment_info = get_mp_payment_status(str(approved_payment_id))
                            _handle_external_mp_payment(payment_info, str(approved_payment_id), db)
                        except Exception as p_err:
                            logger.error(f"Error fetching approved payment {approved_payment_id} for merchant_order {resource_id}: {p_err}")
        except Exception as e:
            logger.error(f"Error processing MP merchant_order {resource_id}: {e}", exc_info=True)

    return {"status": "ok"}


@router.get("/installments")
async def get_real_installments(
    amount: float = Query(..., gt=0),
    bin: Optional[str] = Query(None)
):
    """
    Retorna parcelas e juros 100% REAIS diretamente da API do Mercado Pago
    usando as configurações da conta do vendedor.
    """
    import urllib.request
    import json
    
    mp_token = os.getenv("MP_ACCESS_TOKEN", "")
    if not mp_token:
        raise HTTPException(status_code=500, detail="MP_ACCESS_TOKEN não configurado no backend")
        
    card_bin = (bin or "516292").replace(" ", "").replace("-", "")[:8]
    if len(card_bin) < 6:
        card_bin = "516292"
        
    url = f"https://api.mercadopago.com/v1/payment_methods/installments?bin={card_bin}&amount={amount:.2f}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {mp_token}",
            "User-Agent": "Mozilla/5.0"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data or not isinstance(data, list):
                return {"installments": []}
                
            first = data[0]
            payer_costs = first.get("payer_costs", [])
            results = []
            for pc in payer_costs:
                rate = float(pc.get("installment_rate", 0))
                results.append({
                    "installments": int(pc.get("installments", 1)),
                    "installment_amount": round(float(pc.get("installment_amount", 0)), 2),
                    "total_amount": round(float(pc.get("total_amount", 0)), 2),
                    "installment_rate": rate,
                    "recommended_message": pc.get("recommended_message", ""),
                    "has_interest": rate > 0
                })
            max_free = max([i["installments"] for i in results if not i["has_interest"]], default=1)
            return {
                "payment_method_id": first.get("payment_method_id", ""),
                "issuer": first.get("issuer", {}).get("name", ""),
                "installments": results,
                "max_free_installments": max_free
            }
    except Exception as e:
        logger.error(f"Erro ao buscar parcelas reais no Mercado Pago: {e}")
        return {"installments": [], "max_free_installments": 3}


@router.get("/status/{order_id}")
async def get_payment_status(
    order_id: int,
    payment_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
        
    if current_user and current_user.role != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # If explicit payment_id provided, attempt immediate verification
    if payment_id and order.status == "pending":
        try:
            payment_info = get_mp_payment_status(str(payment_id))
            if payment_info.get("status") in ["approved", "authorized"]:
                finalize_order_on_payment(
                    order=order,
                    db=db,
                    payment_id=str(payment_id),
                    buyer_email=payment_info.get("payer", {}).get("email")
                )
                db.commit()
                db.refresh(order)
        except Exception as e:
            logger.warning(f"Error checking explicit payment_id {payment_id} for order {order_id}: {e}")

    # Proactive payment sync if still pending
    if order.status == "pending":
        from app.repositories.order_repository import OrderRepository
        from app.services.order_service import OrderService
        repo = OrderRepository(db)
        service = OrderService(repo)
        if getattr(order, "stripe_session_id", None):
            service.sync_order_status(order.id)
            db.commit()
            db.refresh(order)
        if order.status == "pending" and (
            getattr(order, "mercadopago_preference_id", None) 
            or getattr(order, "mercadopago_payment_id", None) 
            or order.payment_method in ("mercadopago", "mercadopago_pix", "mercadopago_card")
        ):
            service.sync_mp_order_status(order.id)
            db.commit()
            db.refresh(order)

    # Proactive shipping sync with Melhor Envio if paid or shipped
    if order.status in ("paid", "shipped", "processando_envio", "erro_envio") and getattr(order, "shipment_id", None):
        try:
            from app.services.melhorenvio_service import sync_melhor_envio_status
            sync_melhor_envio_status(order, db)
            db.refresh(order)
        except Exception as me_err:
            logger.debug(f"Proactive ME sync on payment status skipped: {me_err}")


    payment_details = {}
    if order.status == "pending":
        if order.payment_method == "stripe" and order.stripe_session_id:
            try:
                session = get_session(order.stripe_session_id)
                pi = session.get("payment_intent")
                if pi and isinstance(pi, dict) and pi.get("next_action"):
                    action = pi["next_action"]
                    if action.get("type") == "pix_display_qr_code":
                        d = action["pix_display_qr_code"]
                        payment_details = {"method": "pix", "qr_code_url": d.get("image_url_png"), "qr_code_data": d.get("data")}
                    elif action.get("type") == "boleto_display_details":
                        d = action["boleto_display_details"]
                        payment_details = {"method": "boleto", "url": d.get("hosted_voucher_url"), "number": d.get("number")}
            except: pass
        elif order.payment_method in ("mercadopago_pix", "mercadopago") and getattr(order, "mercadopago_payment_id", None):
            try:
                p_info = get_mp_payment_status(str(order.mercadopago_payment_id))
                poi = p_info.get("point_of_interaction", {}) if isinstance(p_info, dict) else {}
                td = poi.get("transaction_data", {}) if isinstance(poi, dict) else {}
                if td.get("qr_code"):
                    payment_details = {
                        "method": "pix",
                        "qr_code_data": td.get("qr_code"),
                        "qr_code_base64": td.get("qr_code_base64"),
                        "ticket_url": td.get("ticket_url"),
                    }
            except Exception:
                pass

    return {
        "order_id": order.id,
        "status": order.status,
        "total": order.total,
        "payment_method": order.payment_method,
        "payment_details": payment_details,
        "tracking_code": getattr(order, "codigo_rastreio", None),
        "etiqueta_url": getattr(order, "etiqueta_url", None)
    }

# Admin list and Patch status kept for backwards compat
@router.get("/admin/orders")
async def list_admin_orders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin": raise HTTPException(status_code=403)
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    return [{
        "id": o.id, "status": o.status, "total": o.total, "payment_method": o.payment_method,
        "buyer_name": o.buyer_name or o.customer_name, "created_at": o.created_at,
        "tracking_code": o.codigo_rastreio, "etiqueta_url": o.etiqueta_url
    } for o in orders]

@router.patch("/admin/orders/{order_id}/status")
async def update_order_status(order_id: int, body: StatusUpdateIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin": raise HTTPException(status_code=403)
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(status_code=404)
    
    if body.status == "paid" and order.status != "paid":
        if order.status == "pending":
            # Keep the legacy admin endpoint on the same post-payment path as
            # the main orders endpoint and both payment webhooks.
            finalize_order_on_payment(order, db)
        else:
            order.status = "paid"
            db.commit()
    else:
        order.status = body.status
        db.commit()
        
    return {"status": "ok"}
