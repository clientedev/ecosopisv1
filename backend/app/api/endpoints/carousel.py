from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.upload_content_type import resolve_stored_image_content_type
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
import uuid

router = APIRouter()

@router.get("", response_model=List[schemas.CarouselItemResponse])
def list_carousel_items(db: Session = Depends(get_db)):
    db.expire_all()
    items = db.query(models.CarouselItem).order_by(models.CarouselItem.order).all()
    return items

@router.post("", response_model=schemas.CarouselItemResponse)
async def create_carousel_item(
    badge: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    order: int = Form(0),
    file: Optional[UploadFile] = File(None),
    mobile_file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    mobile_image_url: Optional[str] = Form(None),
    cta_primary_text: Optional[str] = Form(None),
    cta_primary_link: Optional[str] = Form(None),
    cta_secondary_text: Optional[str] = Form(None),
    cta_secondary_link: Optional[str] = Form(None),
    alignment: str = Form("left"),
    vertical_alignment: str = Form("center"),
    content_max_width: str = Form("500px"),
    glassmorphism: bool = Form(False),
    title_color: str = Form("#ffffff"),
    description_color: str = Form("#ffffff"),
    badge_color: str = Form("#ffffff"),
    badge_bg_color: str = Form("#4a7c59"),
    overlay_color: str = Form("#000000"),
    overlay_opacity: float = Form(0.3),
    offset_x: str = Form("0px"),
    offset_y: str = Form("0px"),
    carousel_height: str = Form("600px"),
    mobile_carousel_height: str = Form("400px"),
    image_fit: str = Form("cover"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    final_image_url = image_url
    if file and file.filename:
        content = await file.read()
        fn = file.filename or f"carousel_{uuid.uuid4()}.jpg"
        content_type = resolve_stored_image_content_type(filename=fn, declared=file.content_type, fallback="image/jpeg")
        stored_image = models.StoredImage(filename=fn, content_type=content_type, data=content)
        db.add(stored_image)
        db.commit()
        db.refresh(stored_image)
        final_image_url = f"/api/images/{stored_image.id}"

    final_mobile_image_url = mobile_image_url
    if mobile_file and mobile_file.filename:
        content = await mobile_file.read()
        fn = mobile_file.filename or f"carousel_mobile_{uuid.uuid4()}.jpg"
        content_type = resolve_stored_image_content_type(filename=fn, declared=mobile_file.content_type, fallback="image/jpeg")
        stored_image = models.StoredImage(filename=fn, content_type=content_type, data=content)
        db.add(stored_image)
        db.commit()
        db.refresh(stored_image)
        final_mobile_image_url = f"/api/images/{stored_image.id}"

    db_item = models.CarouselItem(
        badge=badge,
        title=title,
        description=description,
        image_url=final_image_url,
        mobile_image_url=final_mobile_image_url,
        cta_primary_text=cta_primary_text,
        cta_primary_link=cta_primary_link,
        cta_secondary_text=cta_secondary_text,
        cta_secondary_link=cta_secondary_link,
        order=order,
        alignment=alignment,
        vertical_alignment=vertical_alignment,
        content_max_width=content_max_width,
        glassmorphism=glassmorphism,
        offset_x=offset_x,
        offset_y=offset_y,
        title_color=title_color,
        description_color=description_color,
        badge_color=badge_color,
        badge_bg_color=badge_bg_color,
        overlay_color=overlay_color,
        overlay_opacity=overlay_opacity,
        carousel_height=carousel_height,
        mobile_carousel_height=mobile_carousel_height,
        image_fit=image_fit,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    db.expire_all()
    return db_item

@router.put("/{item_id}", response_model=schemas.CarouselItemResponse)
async def update_carousel_item(
    item_id: int,
    badge: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    order: int = Form(0),
    file: Optional[UploadFile] = File(None),
    mobile_file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    mobile_image_url: Optional[str] = Form(None),
    cta_primary_text: Optional[str] = Form(None),
    cta_primary_link: Optional[str] = Form(None),
    cta_secondary_text: Optional[str] = Form(None),
    cta_secondary_link: Optional[str] = Form(None),
    is_active: bool = Form(True),
    vertical_alignment: str = Form("center"),
    content_max_width: str = Form("500px"),
    glassmorphism: bool = Form(False),
    title_color: str = Form("#ffffff"),
    description_color: str = Form("#ffffff"),
    badge_color: str = Form("#ffffff"),
    badge_bg_color: str = Form("#4a7c59"),
    overlay_color: str = Form("#000000"),
    overlay_opacity: float = Form(0.3),
    alignment: Optional[str] = Form(None),
    offset_x: Optional[str] = Form(None),
    offset_y: Optional[str] = Form(None),
    carousel_height: str = Form("600px"),
    mobile_carousel_height: str = Form("400px"),
    image_fit: str = Form("cover"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_item = db.query(models.CarouselItem).filter(models.CarouselItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    final_image_url = image_url or db_item.image_url
    if file and file.filename:
        content = await file.read()
        fn = file.filename or f"carousel_{uuid.uuid4()}.jpg"
        content_type = resolve_stored_image_content_type(filename=fn, declared=file.content_type, fallback="image/jpeg")
        stored_image = models.StoredImage(filename=fn, content_type=content_type, data=content)
        db.add(stored_image)
        db.commit()
        db.refresh(stored_image)
        final_image_url = f"/api/images/{stored_image.id}"

    final_mobile_image_url = db_item.mobile_image_url
    if mobile_image_url is not None and mobile_image_url != "":
        final_mobile_image_url = mobile_image_url
    if mobile_file and mobile_file.filename:
        content = await mobile_file.read()
        fn = mobile_file.filename or f"carousel_mobile_{uuid.uuid4()}.jpg"
        content_type = resolve_stored_image_content_type(filename=fn, declared=mobile_file.content_type, fallback="image/jpeg")
        stored_image = models.StoredImage(filename=fn, content_type=content_type, data=content)
        db.add(stored_image)
        db.commit()
        db.refresh(stored_image)
        final_mobile_image_url = f"/api/images/{stored_image.id}"

    if badge is not None: db_item.badge = str(badge)
    if title is not None: db_item.title = str(title)
    if description is not None: db_item.description = str(description)
    if final_image_url is not None: db_item.image_url = str(final_image_url)
    db_item.mobile_image_url = final_mobile_image_url
    if cta_primary_text is not None: db_item.cta_primary_text = str(cta_primary_text)
    if cta_primary_link is not None: db_item.cta_primary_link = str(cta_primary_link)
    if cta_secondary_text is not None: db_item.cta_secondary_text = str(cta_secondary_text)
    if cta_secondary_link is not None: db_item.cta_secondary_link = str(cta_secondary_link)
    db_item.order = int(order)
    db_item.is_active = is_active

    if alignment: db_item.alignment = alignment
    if vertical_alignment: db_item.vertical_alignment = vertical_alignment
    if content_max_width: db_item.content_max_width = content_max_width
    if offset_x: db_item.offset_x = offset_x
    if offset_y: db_item.offset_y = offset_y
    db_item.glassmorphism = glassmorphism
    if title_color: db_item.title_color = title_color
    if description_color: db_item.description_color = description_color
    if badge_color: db_item.badge_color = badge_color
    if badge_bg_color: db_item.badge_bg_color = badge_bg_color
    if overlay_color: db_item.overlay_color = overlay_color
    if overlay_opacity is not None: db_item.overlay_opacity = overlay_opacity
    db_item.carousel_height = carousel_height
    db_item.mobile_carousel_height = mobile_carousel_height
    db_item.image_fit = image_fit

    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{item_id}")
def delete_carousel_item(
    item_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    db_item = db.query(models.CarouselItem).filter(models.CarouselItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Item deleted"}
