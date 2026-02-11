from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from app.api.endpoints import auth
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

@router.get("", response_model=List[schemas.NewsResponse])
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

@router.post("", response_model=schemas.NewsResponse)
async def create_news(
    title: str = Form(...),
    content: str = Form(...),
    media_url: Optional[str] = Form(None),
    media_type: Optional[str] = Form("image"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"--- START POST CREATION ---")
    print(f"User: {current_user.email} (ID: {current_user.id})")
    print(f"Title: {title}")
    
    final_media_url = media_url
    final_media_type = media_type

    if file:
        try:
            filename = file.filename or "uploaded_file"
            content_type = file.content_type or "application/octet-stream"
            print(f"Processing file: {filename} ({content_type})")
            
            # More robust media type detection
            is_video = (
                content_type.startswith("video/") or 
                filename.lower().endswith(('.mp4', '.mov', '.avi', '.webm', '.m4v'))
            )
            
            if is_video:
                final_media_type = "video"
            else:
                # Assume image if not video and has content type or extension
                final_media_type = "image"
            
            print(f"Detected media type: {final_media_type}")
                
            file_content = await file.read()
            print(f"File size: {len(file_content)} bytes")
            
            new_image = models.StoredImage(
                data=file_content, 
                filename=filename, 
                content_type=content_type
            )
            db.add(new_image)
            db.flush() # Get the database ID
            
            final_media_url = f"/api/images/{new_image.id}"
            print(f"Media saved successfully. URL: {final_media_url}")
            
        except Exception as e:
            print(f"CRITICAL ERROR processing file: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")

    try:
        db_news = models.News(
            title=title,
            content=content,
            media_url=final_media_url,
            media_type=final_media_type,
            user_id=current_user.id
        )
        db.add(db_news)
        db.commit()
        db.refresh(db_news)
        print(f"Post created successfully with ID: {db_news.id}")
        print(f"--- END POST CREATION ---")
        return db_news
    except Exception as e:
        db.rollback()
        print(f"ERROR saving post to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro ao salvar postagem no banco de dados")

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
