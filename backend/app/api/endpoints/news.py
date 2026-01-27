from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

@router.get("/", response_model=List[schemas.NewsResponse])
def list_news(db: Session = Depends(get_db)):
    return db.query(models.News).order_by(models.News.created_at.desc()).all()

@router.post("/", response_model=schemas.NewsResponse)
def create_news(
    news_in: schemas.NewsCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_news = models.News(**news_in.dict(), user_id=current_user.id)
    db.add(db_news)
    db.commit()
    db.refresh(db_news)
    return db_news

@router.delete("/{news_id}")
def delete_news(
    news_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    news = db.query(models.News).filter(models.News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Post not found")
    if news.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(news)
    db.commit()
    return {"message": "Post deleted"}
