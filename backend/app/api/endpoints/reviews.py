from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from pydantic import BaseModel

router = APIRouter()

class ReviewCreate(BaseModel):
    user_name: str
    comment: str
    rating: int
    product_id: int | None = None

class ReviewUpdate(BaseModel):
    is_approved: bool

@router.post("")
def create_review(data: ReviewCreate, db: Session = Depends(get_db)):
    """Public endpoint to submit a review for approval."""
    if data.product_id is not None:
        product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Produto não encontrado para avaliação")

    review = models.Review(
        user_name=data.user_name,
        comment=data.comment,
        rating=data.rating,
        product_id=data.product_id,
        is_approved=False
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"message": "Review submitted for approval"}

@router.get("/approved")
def get_approved_reviews(db: Session = Depends(get_db)):
    """Public endpoint to list all approved reviews."""
    return db.query(models.Review).filter(models.Review.is_approved == True).all()

@router.get("/pending", response_model=List[dict])
def get_pending_reviews(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to list pending reviews."""
    reviews = db.query(models.Review).filter(models.Review.is_approved == False).all()
    return [{
        "id": r.id, 
        "user_name": r.user_name, 
        "comment": r.comment, 
        "rating": r.rating,
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Geral"
    } for r in reviews]


@router.get("/admin/all", response_model=List[dict])
def get_all_reviews(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to list all reviews (pending and approved)."""
    reviews = db.query(models.Review).order_by(models.Review.created_at.desc()).all()
    return [{
        "id": r.id, 
        "user_name": r.user_name, 
        "comment": r.comment, 
        "rating": r.rating,
        "is_approved": r.is_approved,
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Geral",
        "created_at": r.created_at
    } for r in reviews]

@router.post("/approve/{review_id}")
def approve_review(review_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to approve a review."""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = True
    db.commit()
    return {"message": "Review approved"}

@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to delete a review."""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}
