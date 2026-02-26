from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Request
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
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
    content_type = file.content_type or "image/jpeg"
    
    stored_image = models.StoredImage(
        filename=file.filename or f"{uuid.uuid4()}.jpg",
        content_type=content_type,
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

def generate_qr_code(slug: str, base_url: str = None):
    """Generate a permanent QR code for the product technical page."""
    if not base_url:
        # BASE_URL from env or default to localhost for dev
        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
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

    product_data = product_in.dict(exclude={"details"})
    db_product = models.Product(**product_data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    # Automatically create mandatory details 1:1
    # Try to get host from request headers (useful for railway)
    origin = request.headers.get("origin") or f"{request.url.scheme}://{request.url.netloc}"
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
@router.post("/{slug}/regenerate-qr")
def regenerate_product_qr(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    """Regenerate QR code using the current request origin."""
    db_details = db.query(models.ProductDetail).filter(models.ProductDetail.slug == slug).first()
    if not db_details:
        raise HTTPException(status_code=404, detail="Product details not found")
    
    # Identify origin
    origin = request.headers.get("origin") or f"{request.url.scheme}://{request.url.netloc}"
    qr_path = generate_qr_code(slug, base_url=origin)
    
    db_details.qr_code_path = qr_path
    db.commit()
    db.refresh(db_details)
    return {"message": "QR Code regenerated", "path": qr_path, "url": origin}
