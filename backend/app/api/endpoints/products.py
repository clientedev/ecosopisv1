from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Request
from fastapi.responses import Response, StreamingResponse
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
import io
import requests
import urllib.request
import re
import time
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
    query = query.order_by(models.Product.order.asc(), models.Product.id.asc())
    # Eager load details to ensure QR code path is available
    return query.options(joinedload(models.Product.details)).all()

@router.get("/{slug}/qrcode")
def get_product_qrcode(slug: str, request: Request, db: Session = Depends(get_db)):
    """Generate and return QR code image for a product on-the-fly (no disk required)."""
    product = db.query(models.Product).filter(models.Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Determine base URL from request origin
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if not origin or "localhost" in origin or "127.0.0.1" in origin:
        base_url = os.getenv("RAILWAY_STATIC_URL") or "https://ecosopis.com.br"
        if base_url and not base_url.startswith("http"):
            base_url = f"https://{base_url}"
    else:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

    target_url = f"{base_url.rstrip('/')}/produto/{slug}/info"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return Response(
        content=buf.read(),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="qrcode-{slug}.png"'}
    )

@router.get("/{slug}", response_model=schemas.ProductResponse)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

def generate_qr_code(slug: str, base_url: Optional[str] = None):
    """Generate a permanent QR code for the product technical page pointing to production domain."""
    # Priority: QR_BASE_URL > PUBLIC_URL > FRONTEND_URL (if not localhost) > base_url (if not localhost) > https://ecosopis.com.br
    effective_url = os.getenv("QR_BASE_URL") or os.getenv("PUBLIC_URL")
    
    if not effective_url:
        frontend_env = os.getenv("FRONTEND_URL")
        if frontend_env and "localhost" not in frontend_env and "127.0.0.1" not in frontend_env:
            effective_url = frontend_env

    if not effective_url and base_url and "localhost" not in base_url and "127.0.0.1" not in base_url:
        effective_url = base_url

    if not effective_url:
        if os.getenv("RAILWAY_STATIC_URL"):
            effective_url = f"https://{os.getenv('RAILWAY_STATIC_URL')}"
        elif os.getenv("REPLIT_DEV_DOMAIN"):
            effective_url = f"https://{os.getenv('REPLIT_DEV_DOMAIN')}"
        else:
            effective_url = "https://ecosopis.com.br"
    
    # Remove trailing slash if present
    effective_url = effective_url.rstrip('/')
    target_url = f"{effective_url}/produto/{slug}/info"
    
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
    # Toggle status: allows both activation and deactivation via DELETE requests
    # which is used by the frontend Dashboard toggle.
    db_product.is_active = not db_product.is_active
    db.commit()
    return {"message": "Status updated", "is_active": db_product.is_active}
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

@router.get("/drive-stream/{file_id}")
def stream_drive_video(file_id: str, request: Request):
    """
    Proxy stream de vídeo do Google Drive direto para tags <video> HTML5.
    Resolve problemas de CORS, cookies de sessão e headers de Range.
    """
    drive_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    req_headers = {}
    if "range" in request.headers:
        req_headers["Range"] = request.headers["range"]

    try:
        r = requests.get(drive_url, headers=req_headers, stream=True, timeout=15)
        
        def iterfile():
            try:
                for chunk in r.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        yield chunk
            finally:
                r.close()

        res_headers = {
            "Content-Type": r.headers.get("Content-Type", "video/mp4"),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
        if "Content-Length" in r.headers:
            res_headers["Content-Length"] = r.headers["Content-Length"]
        if "Content-Range" in r.headers:
            res_headers["Content-Range"] = r.headers["Content-Range"]

        status_code = 206 if "Content-Range" in r.headers else 200
        return StreamingResponse(iterfile(), status_code=status_code, headers=res_headers)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao carregar vídeo do Drive: {str(e)}")

_ig_cache = {}

@router.get("/instagram-stream/{reel_id}")
def stream_instagram_video(reel_id: str, request: Request):
    """
    Proxy stream de vídeo MP4 direto do Instagram Reels para tags <video> HTML5.
    Resolve reprodução automática sem pedir play, remove bordas/cabeçalho/rodapé do Instagram,
    e permite streaming nativo com suporte a Range requests (HTTP 206).
    """
    now = time.time()
    mp4_url = None
    if reel_id in _ig_cache and _ig_cache[reel_id]["expires"] > now:
        mp4_url = _ig_cache[reel_id]["url"]
    else:
        try:
            embed_url = f"https://www.instagram.com/reel/{reel_id}/embed/"
            ig_req = urllib.request.Request(
                embed_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            html = urllib.request.urlopen(ig_req, timeout=8).read().decode("utf-8", errors="ignore")
            matches = re.findall(r'https:[^\"\'<>\s]+?\.mp4[^\"\'<>\s]*', html)
            if matches:
                clean = matches[0].replace(r'\\/', '/').replace(r'\/', '/').replace(r'\u0026', '&').rstrip('\\').rstrip('"')
                mp4_url = clean
                _ig_cache[reel_id] = {"url": clean, "expires": now + 7200}
        except Exception as e:
            print(f"Error fetching IG embed for reel {reel_id}: {e}")

    if not mp4_url:
        raise HTTPException(status_code=404, detail="Não foi possível obter o stream de vídeo do Instagram")

    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.instagram.com/"
    }
    if "range" in request.headers:
        req_headers["Range"] = request.headers["range"]

    try:
        r = requests.get(mp4_url, headers=req_headers, stream=True, timeout=15)
        if r.status_code not in (200, 206):
            if reel_id in _ig_cache:
                del _ig_cache[reel_id]
            raise HTTPException(status_code=r.status_code, detail="Instagram CDN retornou status de erro")

        def iterfile():
            try:
                for chunk in r.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        yield chunk
            finally:
                r.close()

        res_headers = {
            "Content-Type": r.headers.get("Content-Type", "video/mp4"),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
        if "Content-Length" in r.headers:
            res_headers["Content-Length"] = r.headers["Content-Length"]
        if "Content-Range" in r.headers:
            res_headers["Content-Range"] = r.headers["Content-Range"]

        status_code = 206 if "Content-Range" in r.headers else 200
        return StreamingResponse(iterfile(), status_code=status_code, headers=res_headers)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao transmitir vídeo do Instagram: {str(e)}")


