from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_admin
import uuid

router = APIRouter()

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
    
    return {"url": f"/api/images/{stored_image.id}", "id": stored_image.id}

@router.get("/{image_id}")
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.StoredImage).filter(models.StoredImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return Response(
        content=image.data,
        media_type=image.content_type,
        headers={"Cache-Control": "public, max-age=31536000"}
    )

@router.delete("/{image_id}")
def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    image = db.query(models.StoredImage).filter(models.StoredImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    db.delete(image)
    db.commit()
    return {"message": "Image deleted"}
