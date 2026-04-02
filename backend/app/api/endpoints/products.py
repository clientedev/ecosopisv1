from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.core.database import get_db
from app.core.upload_content_type import resolve_stored_image_content_type
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from pydantic import BaseModel
import uuid
import qrcode
import os
from sqlalchemy import text

router = APIRouter()

class AnnouncementUpdate(BaseModel):
    text: str
    bg_color: str
    text_color: str
    is_active: bool
    is_scrolling: bool = False
    repeat_text: bool = True
    scroll_speed: int = 20

@router.get("/announcement")
def get_announcement(db: Session = Depends(get_db)):
    try:
        announcement = db.query(models.AnnouncementBar).first()
        if not announcement:
            announcement = models.AnnouncementBar(
                text="Bem-vinda à ECOSOPIS! Frete grátis em compras acima de R$ 150",
                bg_color="#2d5a27",
                text_color="#ffffff",
                is_active=True,
                is_scrolling=False,
                repeat_text=True,
                scroll_speed=20
            )
            db.add(announcement)
            db.commit()
            db.refresh(announcement)
        return announcement
    except Exception as e:
        print(f"Error in get_announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/announcement")
def update_announcement(data: AnnouncementUpdate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    try:
        announcement = db.query(models.AnnouncementBar).first()
        if not announcement:
            announcement = models.AnnouncementBar(text=data.text)
            db.add(announcement)
        
        announcement.text = data.text
        announcement.bg_color = data.bg_color
        announcement.text_color = data.text_color
        announcement.is_active = data.is_active
        announcement.is_scrolling = data.is_scrolling
        announcement.repeat_text = data.repeat_text
        announcement.scroll_speed = data.scroll_speed
        
        db.commit()
        db.refresh(announcement)
        return announcement
    except Exception as e:
        print(f"Error in update_announcement: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    content = await file.read()
    fn = file.filename or f"{uuid.uuid4()}.jpg"

    stored_image = models.StoredImage(
        filename=fn,
        content_type=resolve_stored_image_content_type(
            filename=fn, declared=file.content_type, fallback="application/octet-stream"
        ),
        data=content
    )
    db.add(stored_image)
    db.commit()
    db.refresh(stored_image)
    
    return {"url": f"/api/images/{stored_image.id}"}

@router.get("", response_model=List[schemas.ProductResponse])
def list_products(db: Session = Depends(get_db), include_inactive: bool = False):
    query = db.query(models.Product)
    if not include_inactive:
        query = query.filter(models.Product.is_active == True)
    # Eager load details to ensure QR code path is available
    return query.options(joinedload(models.Product.details)).all()

@router.get("/{slug}", response_model=schemas.ProductResponse)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

def generate_qr_code(slug: str, base_url: Optional[str] = None):
    """Generate a permanent QR code for the product technical page."""
    # Strict Production Enforcement: If no URL provided or URL is localhost, try production fallbacks
    is_replit = os.getenv("REPLIT_DEV_DOMAIN") or os.getenv("REPL_ID") or os.getenv("REPL_SLUG")
    is_railway = os.getenv("RAILWAY_STATIC_URL") or os.getenv("RAILWAY_PROJECT_ID")
    is_local_dev = os.getenv("ENV") == "development" or os.getenv("LOCAL_DEV") == "true"
    
    if not base_url or ("localhost" in base_url or "127.0.0.1" in base_url):
        if not is_local_dev:
            replit_domain = os.getenv("REPLIT_DEV_DOMAIN")
            if replit_domain:
                base_url = f"https://{replit_domain}"
            elif os.getenv("RAILWAY_STATIC_URL"):
                base_url = f"https://{os.getenv('RAILWAY_STATIC_URL')}"
            else:
                base_url = "https://ecosopis.com.br"
        else:
            base_url = base_url or "http://localhost:3000"
    
    # Remove trailing slash if present
    base_url = base_url.rstrip('/')
    target_url = f"{base_url}/produto/{slug}/info"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(target_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # Ensure directory exists in all environments (Railway/local).
    os.makedirs("static/qrcodes", exist_ok=True)

    # Filename is just the slug to ensure permanence
    file_path = f"static/qrcodes/{slug}.png"
    img.save(file_path)
    return f"/{file_path}"

@router.post("", response_model=schemas.ProductResponse)
def create_product(
    product_in: schemas.ProductCreate, 
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    # Ensure slug is unique
    existing = db.query(models.Product).filter(models.Product.slug == product_in.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")

    # `origin` is used only for QR URL generation and is not a Product column.
    product_data = product_in.dict(exclude={"details", "origin"})
    db_product = models.Product(**product_data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    # Identify origin - Prioritize body, then FRONTEND_URL, then EXTERNAL_URL, then Headers
    origin = product_in.origin
    if not origin:
        origin = os.getenv("FRONTEND_URL") or os.getenv("EXTERNAL_URL")
    
    if not origin:
        forwarded_host = request.headers.get("x-forwarded-host")
        forwarded_proto = request.headers.get("x-forwarded-proto", "https")
        if forwarded_host:
            # Handle potentially comma-separated hosts (proxy chains)
            main_host = forwarded_host.split(',')[0].strip()
            origin = f"{forwarded_proto}://{main_host}"
        else:
            origin = f"{request.url.scheme}://{request.url.netloc}"
            
    # Final safety check for production environments (Replit/Railway)
    is_prod = os.getenv("NODE_ENV") == "production"
    replit_domain = os.getenv("REPLIT_DEV_DOMAIN")
    
    if "localhost" in origin or "127.0.0.1" in origin:
        if replit_domain:
            origin = f"https://{replit_domain}"
        elif os.getenv("RAILWAY_STATIC_URL"):
            origin = f"https://{os.getenv('RAILWAY_STATIC_URL')}"
        elif is_prod:
            origin = "https://ecosopis.com.br"

    qr_path = generate_qr_code(db_product.slug, base_url=origin)
    
    details_data = {}
    if product_in.details:
        details_data = product_in.details.dict(exclude_unset=True)
    
    db_details = models.ProductDetail(
        product_id=db_product.id,
        slug=db_product.slug, # Mandatory immutable link
        qr_code_path=qr_path,
        **details_data
    )
    db.add(db_details)
    db.commit()
    
    db.refresh(db_product)
    return db_product

@router.get("/{product_id}/label.zpl")
def export_product_label_zpl(
    product_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    details = db.query(models.ProductDetail).filter(models.ProductDetail.product_id == db_product.id).first()
    qr_target = f"/produto/{db_product.slug}/info"
    if details and details.slug:
        qr_target = f"/produto/{details.slug}/info"

    safe_name = (db_product.name or "").replace("^", " ").replace("~", " ")
    safe_slug = (db_product.slug or "").replace("^", "-").replace("~", "-")
    safe_price = f"R$ {float(db_product.price or 0):.2f}"
    safe_stock = f"Estoque: {int(db_product.stock or 0)}"

    zpl = (
        "^XA\n"
        "^CI28\n"
        "^PW800\n"
        "^LL500\n"
        "^FO40,40^A0N,42,42^FD"
        + safe_name[:40]
        + "^FS\n"
        "^FO40,95^A0N,28,28^FDSKU: "
        + safe_slug[:48]
        + "^FS\n"
        "^FO40,140^A0N,34,34^FD"
        + safe_price
        + "^FS\n"
        "^FO40,185^A0N,28,28^FD"
        + safe_stock
        + "^FS\n"
        "^FO40,235^A0N,24,24^FD"
        + qr_target[:64]
        + "^FS\n"
        "^FO560,80^BQN,2,6^FDLA,"
        + qr_target[:120]
        + "^FS\n"
        "^XZ\n"
    )

    return Response(
        content=zpl,
        media_type="application/zpl",
        headers={"Content-Disposition": f'attachment; filename="label-{db_product.slug}.zpl"'},
    )

@router.get("/{slug}/info", response_model=schemas.ProductDetailResponse)
def get_product_info(slug: str, db: Session = Depends(get_db)):
    """Public endpoint for technical info page."""
    details = db.query(models.ProductDetail).filter(models.ProductDetail.slug == slug).first()
    if not details:
        # Fallback: if product exists but details doesn't (legacy data), created it?
        # Requirement: "When a product is created → detail page must be created"
        # For legacy, we just 404
        raise HTTPException(status_code=404, detail="Technical details not found")
    return details

@router.put("/{product_id}/details", response_model=schemas.ProductDetailResponse)
def update_product_details(
    product_id: int,
    details_in: schemas.ProductDetailUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """Admin endpoint to update technical info."""
    db_details = db.query(models.ProductDetail).filter(models.ProductDetail.product_id == product_id).first()
    if not db_details:
        raise HTTPException(status_code=404, detail="Product details not found")
    
    update_data = details_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        # Slug is NOT in schemas.ProductDetailUpdate, ensuring immutability
        setattr(db_details, key, value)
    
    db.commit()
    db.refresh(db_details)
    return db_details

@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_in: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key == "slug":
            continue # Slug is immutable
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Soft delete: preserve referential integrity with orders
    db_product.is_active = False
    db.commit()
    return {"message": "Product deactivated"}
class QRRegenerate(BaseModel):
    origin: Optional[str] = None

@router.post("/{slug}/regenerate-qr")
def regenerate_product_qr(
    slug: str,
    request: Request,
    data: Optional[QRRegenerate] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """Regenerate QR code using provided origin or current request origin."""
    try:
        db_product = db.query(models.Product).filter(models.Product.slug == slug).first()
        if not db_product:
            raise HTTPException(status_code=404, detail="Product not found")

        db_details = db.query(models.ProductDetail).filter(models.ProductDetail.product_id == db_product.id).first()
        
        # Identify origin - Prioritize body, then env vars, then Headers
        origin = data.origin if data else None
        
        if not origin:
            origin = os.getenv("FRONTEND_URL") or os.getenv("EXTERNAL_URL")
            
        if not origin:
            forwarded_host = request.headers.get("x-forwarded-host")
            forwarded_proto = request.headers.get("x-forwarded-proto", "https")
            if forwarded_host:
                main_host = forwarded_host.split(',')[0].strip()
                origin = f"{forwarded_proto}://{main_host}"
            else:
                origin = f"{request.url.scheme}://{request.url.netloc}"
        
        # Final safety check for cloud environments (Replit/Railway/Prod)
        is_replit = os.getenv("REPLIT_DEV_DOMAIN") or os.getenv("REPL_ID") or os.getenv("REPL_SLUG")
        is_railway = os.getenv("RAILWAY_STATIC_URL") or os.getenv("RAILWAY_PROJECT_ID")
        is_local_dev = os.getenv("ENV") == "development" or os.getenv("LOCAL_DEV") == "true"
        
        if ("localhost" in origin or "127.0.0.1" in origin) and not is_local_dev:
            replit_domain = os.getenv("REPLIT_DEV_DOMAIN")
            if replit_domain:
                origin = f"https://{replit_domain}"
            elif os.getenv("RAILWAY_STATIC_URL"):
                origin = f"https://{os.getenv('RAILWAY_STATIC_URL')}"
            else:
                origin = "https://ecosopis.com.br"

        qr_path = generate_qr_code(slug, base_url=origin)
        
        if not db_details:
            db_details = models.ProductDetail(
                product_id=db_product.id,
                slug=db_product.slug,
                qr_code_path=qr_path
            )
            db.add(db_details)
        else:
            db_details.qr_code_path = qr_path
            
        db.commit()
        db.refresh(db_details)
        return {"message": "QR Code regenerated", "path": qr_path, "url": origin}
    except Exception as e:
        print(f"Error regenerating QR code: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao regenerar QR Code: {str(e)}")
