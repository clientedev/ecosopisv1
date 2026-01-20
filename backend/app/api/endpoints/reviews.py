from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.core.security import get_current_user, get_current_admin_user

router = APIRouter()

@router.post("/{product_id}/reviews")
def create_review(product_id: int, review: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_review = models.Review(
        product_id=product_id,
        user_name=current_user.full_name or current_user.email,
        comment=review.get("comment"),
        rating=review.get("rating", 5),
        is_approved=False
    )
    db.add(db_review)
    db.commit()
    return {"message": "Review submitted for approval"}

@router.get("/pending", response_model=List[dict])
def get_pending_reviews(db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    reviews = db.query(models.Review).filter(models.Review.is_approved == False).all()
    return [{"id": r.id, "user_name": r.user_name, "comment": r.comment, "rating": r.rating, "product_name": r.product.name} for r in reviews]

@router.post("/approve/{review_id}")
def approve_review(review_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = True
    db.commit()
    return {"message": "Review approved"}

@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}
