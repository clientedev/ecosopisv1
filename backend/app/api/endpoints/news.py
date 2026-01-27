from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.api.endpoints import auth
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

@router.get("/", response_model=List[schemas.NewsResponse])
def list_news(db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(auth.get_current_user_optional)):
    news_list = db.query(models.News).order_by(models.News.created_at.desc()).all()
    
    results = []
    for news in news_list:
        news_data = schemas.NewsResponse.from_orm(news)
        news_data.likes_count = len(news.likes)
        if current_user:
            news_data.is_liked = any(like.user_id == current_user.id for like in news.likes)
        results.append(news_data)
    
    return results

@router.post("/{news_id}/like")
def like_news(news_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing_like = db.query(models.NewsLike).filter(
        models.NewsLike.news_id == news_id,
        models.NewsLike.user_id == current_user.id
    ).first()
    
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"liked": False}
    
    new_like = models.NewsLike(news_id=news_id, user_id=current_user.id)
    db.add(new_like)
    db.commit()
    return {"liked": True}

@router.post("/{news_id}/comment", response_model=schemas.NewsCommentResponse)
def comment_news(
    news_id: int, 
    comment_in: schemas.NewsCommentCreate,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    new_comment = models.NewsComment(
        news_id=news_id, 
        user_id=current_user.id, 
        content=comment_in.content
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return new_comment

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
