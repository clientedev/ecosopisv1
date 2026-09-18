from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json
import urllib.request
import re
import html
from app.api.endpoints import auth
from app.core.database import get_db
from app.core.upload_content_type import resolve_stored_image_content_type
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_user
from pydantic import BaseModel
from sqlalchemy import func

router = APIRouter()

@router.get("", response_model=List[schemas.NewsResponse])
def list_news(db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(auth.get_current_user_optional)):
    news_list = (
        db.query(models.News)
        .options(
            joinedload(models.News.user),
            joinedload(models.News.likes),
            joinedload(models.News.comments).joinedload(models.NewsComment.user),
        )
        .order_by(models.News.created_at.desc())
        .all()
    )

    results = []
    for news in news_list:
        news_data = schemas.NewsResponse.model_validate(news)
        def _comment_sort_key(c: models.NewsComment) -> float:
            if c.created_at is None:
                return 0.0
            return c.created_at.timestamp()

        sorted_comments = sorted(news.comments, key=_comment_sort_key)
        news_data = news_data.model_copy(
            update={
                "likes_count": len(news.likes),
                "comments_count": len(news.comments),
                "comments": [schemas.NewsCommentResponse.model_validate(c) for c in sorted_comments],
                "is_liked": (
                    any(like.user_id == current_user.id for like in news.likes)
                    if current_user
                    else False
                ),
            }
        )
        results.append(news_data)

    return results

@router.get("/instagram-info")
def get_instagram_info(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL inválida")

    permalink = url
    caption = ""
    author_name = ""
    username = ""

    # 1. Extração direta de código embed (blockquote)
    if "instagram-media" in url or "data-instgrm" in url:
        m_perm = re.search(r'data-instgrm-permalink=["\']([^"\']+)["\']', url, re.I)
        if m_perm:
            permalink = m_perm.group(1)

        m_author = re.search(r'compartilhada por\s+([^<]+)', url, re.I)
        if m_author:
            author_text = m_author.group(1).strip()
            author_name = author_text
            m_un = re.search(r'\(@?([A-Za-z0-9_.]+)\)', author_text)
            if m_un:
                username = f"@{m_un.group(1)}"

        m_paras = re.findall(r'<p[^>]*>(.*?)</p>', url, re.DOTALL | re.I)
        if m_paras:
            clean_p = [re.sub(r'<[^>]+>', '', p).strip() for p in m_paras]
            caption = "\n".join([p for p in clean_p if p and "Uma publicação" not in p and "A post shared" not in p])

    m_id = re.search(r'instagram\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)', permalink, re.I)
    post_id = m_id.group(1) if m_id else ""
    clean_url = f"https://www.instagram.com/p/{post_id}/" if post_id else permalink
    thumbnail_url = ""

    # 2. Busca dados pelo scraper crawler
    if post_id:
        try:
            req = urllib.request.Request(
                clean_url,
                headers={'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'}
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = resp.read().decode('utf-8', errors='ignore')

                m_title = re.search(r'<meta[^>]+(?:name|property)=["\']twitter:title["\'][^>]+content=["\'](.*?)["\']', data, re.I)
                if m_title:
                    raw_title = html.unescape(m_title.group(1))
                    m_parts = re.match(r'(.*?)\s*\(?(@[A-Za-z0-9_.]+)\)?', raw_title)
                    if m_parts:
                        if not author_name:
                            author_name = m_parts.group(1).strip()
                        if not username:
                            username = m_parts.group(2).strip()
                    elif not author_name:
                        author_name = raw_title.split('•')[0].strip()

                m_img = re.search(r'<meta[^>]+(?:name|property)=["\'](?:twitter:image|og:image)["\'][^>]+content=["\'](.*?)["\']', data, re.I)
                if m_img:
                    thumbnail_url = html.unescape(m_img.group(1))

                m_desc = re.search(r'<meta[^>]+(?:name|property)=["\'](?:og:description|description)["\'][^>]+content=["\'](.*?)["\']', data, re.I)
                if m_desc and not caption:
                    caption = html.unescape(m_desc.group(1)).strip()
        except Exception as e:
            print(f"Error scraping Instagram info: {e}")

    display_title = ""
    if author_name and username:
        display_title = f"{author_name} ({username})"
    elif author_name:
        display_title = author_name
    elif username:
        display_title = username
    else:
        display_title = "Publicação no Instagram"

    return {
        "id": post_id,
        "url": clean_url,
        "author_name": author_name or (username if username else "Instagram"),
        "username": username,
        "title": display_title,
        "caption": caption or "",
        "thumbnail_url": thumbnail_url
    }

@router.get("/{news_id}", response_model=schemas.NewsResponse)
def get_news(
    news_id: int, 
    db: Session = Depends(get_db), 
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    news = (
        db.query(models.News)
        .options(
            joinedload(models.News.user),
            joinedload(models.News.likes),
            joinedload(models.News.comments).joinedload(models.NewsComment.user),
        )
        .filter(models.News.id == news_id)
        .first()
    )
    if not news:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    news_data = schemas.NewsResponse.model_validate(news)
    def _comment_sort_key(c: models.NewsComment) -> float:
        if c.created_at is None:
            return 0.0
        return c.created_at.timestamp()

    sorted_comments = sorted(news.comments, key=_comment_sort_key)
    
    return news_data.model_copy(
        update={
            "likes_count": len(news.likes),
            "comments_count": len(news.comments),
            "comments": [schemas.NewsCommentResponse.model_validate(c) for c in sorted_comments],
            "is_liked": (
                any(like.user_id == current_user.id for like in news.likes)
                if current_user
                else False
            ),
        }
    )

@router.post("/{news_id}/like")
def like_news(news_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    news = db.query(models.News).filter(models.News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing_like = db.query(models.NewsLike).filter(
        models.NewsLike.news_id == news_id,
        models.NewsLike.user_id == current_user.id
    ).first()

    if existing_like:
        db.delete(existing_like)
        db.commit()
    else:
        db.add(models.NewsLike(news_id=news_id, user_id=current_user.id))
        db.commit()

    likes_count = (
        db.query(models.NewsLike).filter(models.NewsLike.news_id == news_id).count()
    )
    return {"liked": existing_like is None, "likes_count": likes_count}

@router.post("/{news_id}/comment", response_model=schemas.NewsCommentResponse)
def comment_news(
    news_id: int, 
    comment_in: schemas.NewsCommentCreate,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    news = db.query(models.News).filter(models.News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    text = (comment_in.content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comentário não pode ser vazio")

    if current_user.role != "admin":
        paid_orders_count = (
            db.query(models.Order)
            .filter(
                models.Order.user_id == current_user.id,
                func.lower(models.Order.status).in_(["paid", "pago"]),
            )
            .count()
        )
        if paid_orders_count == 0:
            raise HTTPException(
                status_code=403,
                detail="Somente clientes com pelo menos uma compra paga podem comentar.",
            )

    new_comment = models.NewsComment(
        news_id=news_id,
        user_id=current_user.id,
        content=text,
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    c = (
        db.query(models.NewsComment)
        .options(joinedload(models.NewsComment.user))
        .filter(models.NewsComment.id == new_comment.id)
        .first()
    )
    return schemas.NewsCommentResponse.model_validate(c)

@router.delete("/{news_id}/comment/{comment_id}")
def delete_news_comment(
    news_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = (
        db.query(models.NewsComment)
        .filter(
            models.NewsComment.id == comment_id,
            models.NewsComment.news_id == news_id,
        )
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")

    if current_user.role != "admin" and comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Não autorizado a excluir este comentário")

    db.delete(comment)
    db.commit()
    return {"message": "Comentário excluído"}

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
    # Check permission: must be admin OR have can_post_news flag
    if current_user.role != "admin" and not current_user.can_post_news:
        raise HTTPException(
            status_code=403,
            detail="Você não tem permissão para criar postagens no blog. Solicite acesso ao administrador."
        )

    print(f"--- START POST CREATION ---")
    print(f"User: {current_user.email} (ID: {current_user.id})")
    print(f"Title: {title}")
    
    final_media_url = media_url
    final_media_type = media_type

    if not file and media_url:
        if "instagram.com" in media_url or "instagram-media" in media_url or "instagr.am" in media_url:
            final_media_type = "instagram"

    if file:
        try:
            filename = getattr(file, "filename", "uploaded_file") or "uploaded_file"
            original_ct = getattr(file, "content_type", None)
            content_type = resolve_stored_image_content_type(
                filename=filename, declared=original_ct, fallback="application/octet-stream"
            )
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
