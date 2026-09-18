from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.api.endpoints.auth import get_current_admin
from pydantic import BaseModel

router = APIRouter()

def normalize_images(images_val) -> list[str]:
    """
    Normaliza o campo de imagens da avaliação para garantir SEMPRE uma lista Python de URLs (strings).
    Trata strings JSON, listas aninhadas, strings vazias, URLs únicas e valores nulos.
    """
    if not images_val:
        return []
    if isinstance(images_val, list):
        result: list[str] = []
        for item in images_val:
            if isinstance(item, str):
                cleaned = item.strip().strip('"').strip("'")
                if cleaned.startswith("[") and cleaned.endswith("]"):
                    result.extend(normalize_images(cleaned))
                elif cleaned:
                    result.append(cleaned)
            elif isinstance(item, list):
                result.extend(normalize_images(item))
        return result
    if isinstance(images_val, str):
        val = images_val.strip()
        if not val or val in ("[]", "null", "None", '""'):
            return []
        try:
            parsed = json.loads(val)
            if isinstance(parsed, (list, str)):
                return normalize_images(parsed)
        except Exception:
            pass
        # Caso seja separado por vírgula
        if "," in val and ("http://" in val or "https://" in val):
            return [p.strip().strip('"').strip("'") for p in val.split(",") if p.strip()]
        val_clean = val.strip('"').strip("'")
        if val_clean.startswith("http://") or val_clean.startswith("https://") or val_clean.startswith("/"):
            return [val_clean]
    return []

class ReviewCreate(BaseModel):
    user_name: str
    comment: str
    rating: int
    product_id: int | None = None
    images: list[str] | None = []

class ReviewItemImport(BaseModel):
    user_name: str
    comment: str
    rating: Optional[int] = 5
    images: Optional[list[str]] = []

class ReviewBatchImport(BaseModel):
    product_id: int
    reviews: list[ReviewItemImport]

class ShopeeCloneRequest(BaseModel):
    product_id: int
    shopee_url: Optional[str] = None
    custom_text: Optional[str] = None
    auto_publish: bool = True

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
        images=normalize_images(data.images),
        is_approved=False
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"message": "Review submitted for approval", "id": review.id}

@router.post("/clone-shopee")
def clone_shopee_reviews(data: ShopeeCloneRequest, db: Session = Depends(get_db)):
    """
    Clona avaliações do produto a partir do link da Shopee cadastrado no produto
    (ou informado), extraindo ou sintetizando as melhores avaliações 5 estrelas
    com textos persuasivos e fotos reais de clientes, SEM NENHUM SELO OU MENÇÃO À SHOPEE.
    """
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    # Atualiza o shopee_url do produto se informado e ainda não salvo
    target_url = (data.shopee_url or "").strip() or (product.shopee_url or "").strip()
    if data.shopee_url and data.shopee_url.strip() and not product.shopee_url:
        product.shopee_url = data.shopee_url.strip()
        db.commit()

    generated_reviews: list[dict] = []

    # Parse real reviews pasted directly from Shopee
    if not data.custom_text or not data.custom_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Por favor, cole o texto copiado das avaliações da Shopee no campo de texto para importá-las. Não geramos avaliações fictícias."
        )

    raw_text = data.custom_text.strip()
    raw_lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    
    current_author = "Cliente Verificada"
    current_comment_parts = []
    current_imgs = []

    # Ignored Shopee UI boilerplate lines
    skip_keywords = [
        "denunciar", "útil", "util", "variação:", "variacao:", "tamanho:", "cor:",
        "avaliação do comprador", "classificação do produto", "recomenda este produto",
        "estrelas", "helpful", "report"
    ]

    for line in raw_lines:
        lower_line = line.lower()

        # Image link
        if line.startswith("http://") or line.startswith("https://"):
            current_imgs.append(line)
            continue

        # Skip UI noise
        if any(skip in lower_line for skip in skip_keywords):
            continue

        # Check if line looks like a Shopee author line (e.g. j***a, fulano123, Maria S.)
        is_masked_user = "***" in line and len(line) <= 25
        is_short_handle = len(line.split()) <= 2 and len(line) <= 22 and not any(p in line for p in [".", ",", "!", "?"]) and not line.isdigit()

        if (is_masked_user or is_short_handle) and current_comment_parts:
            # Save previous review
            comment_text = " ".join(current_comment_parts).strip()
            if len(comment_text) >= 5:
                generated_reviews.append({
                    "user_name": current_author,
                    "rating": 5,
                    "comment": comment_text,
                    "images": normalize_images(current_imgs)
                })
            current_comment_parts = []
            current_imgs = []
            current_author = line.strip()
        elif is_masked_user or (is_short_handle and not current_comment_parts):
            current_author = line.strip()
        else:
            # Normal review comment line
            current_comment_parts.append(line)

    if current_comment_parts:
        comment_text = " ".join(current_comment_parts).strip()
        if len(comment_text) >= 5:
            generated_reviews.append({
                "user_name": current_author,
                "rating": 5,
                "comment": comment_text,
                "images": normalize_images(current_imgs)
            })

    if not generated_reviews:
        raise HTTPException(
            status_code=400,
            detail="Não foi possível identificar avaliações válidas no texto colado. Certifique-se de colar os comentários reais da Shopee."
        )

    # Se auto_publish estiver ativado, salva diretamente no banco
    if data.auto_publish:
        for rev_data in generated_reviews:
            new_rev = models.Review(
                user_name=rev_data["user_name"],
                comment=rev_data["comment"],
                rating=rev_data["rating"],
                product_id=product.id,
                images=normalize_images(rev_data.get("images", [])),
                is_approved=True
            )
            db.add(new_rev)
        db.commit()

    return {
        "success": True,
        "product_id": product.id,
        "shopee_url": target_url,
        "count": len(generated_reviews),
        "message": f"{len(generated_reviews)} avaliações reais importadas com sucesso!",
        "reviews": generated_reviews
    }

@router.post("/import-batch")
def import_reviews_batch(
    data: ReviewBatchImport, 
    db: Session = Depends(get_db)
):
    """
    Endpoint para importar avaliações reais de clientes em lote
    (textos, fotos, avaliações 5 estrelas) sem nenhum selo ou menção a plataformas externas.
    """
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    imported_count = 0
    for item in data.reviews:
        rev = models.Review(
            user_name=item.user_name.strip(),
            comment=item.comment.strip(),
            rating=item.rating or 5,
            product_id=data.product_id,
            images=normalize_images(item.images),
            is_approved=True # já entra aprovada
        )
        db.add(rev)
        imported_count += 1

    db.commit()
    return {"message": f"{imported_count} avaliações importadas e publicadas com sucesso!"}

@router.get("/approved")
def get_approved_reviews(
    product_id: Optional[int] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Public endpoint to list all approved reviews, with optional filtering and limit."""
    query = db.query(models.Review).options(joinedload(models.Review.product)).filter(models.Review.is_approved == True)
    if product_id is not None:
        query = query.filter(models.Review.product_id == product_id)
    query = query.order_by(models.Review.created_at.desc())
    if limit is not None:
        query = query.limit(limit)
    reviews = query.all()
    return [{
        "id": r.id,
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Geral",
        "user_name": r.user_name,
        "comment": r.comment,
        "rating": r.rating,
        "images": normalize_images(r.images),
        "is_approved": r.is_approved,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in reviews]

@router.get("/pending", response_model=List[dict])
def get_pending_reviews(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to list pending reviews."""
    reviews = db.query(models.Review).options(joinedload(models.Review.product)).filter(models.Review.is_approved == False).order_by(models.Review.created_at.desc()).all()
    return [{
        "id": r.id, 
        "user_name": r.user_name, 
        "comment": r.comment, 
        "rating": r.rating,
        "images": normalize_images(r.images),
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Geral",
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in reviews]

@router.get("/admin/all", response_model=List[dict])
def get_all_reviews(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to list all reviews (pending and approved)."""
    reviews = db.query(models.Review).options(joinedload(models.Review.product)).order_by(models.Review.created_at.desc()).all()
    return [{
        "id": r.id, 
        "user_name": r.user_name, 
        "comment": r.comment, 
        "rating": r.rating,
        "images": normalize_images(r.images),
        "is_approved": r.is_approved,
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Geral",
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in reviews]

@router.post("/approve/{review_id}")
def approve_review(review_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to approve a single review."""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = True
    db.commit()
    return {"message": "Review approved"}

@router.post("/admin/approve-all/{product_id}")
def approve_all_product_reviews(product_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to approve all pending reviews for a product (or all products if product_id == 0)."""
    query = db.query(models.Review).filter(models.Review.is_approved == False)
    if product_id != 0:
        query = query.filter(models.Review.product_id == product_id)
    count = query.update({models.Review.is_approved: True}, synchronize_session="fetch")
    db.commit()
    return {"message": f"{count} avaliações aprovadas com sucesso!", "count": count}

@router.delete("/admin/product/{product_id}")
def delete_all_product_reviews(product_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to delete all reviews for a specific product."""
    if product_id == 0:
        count = db.query(models.Review).filter(models.Review.product_id == None).delete(synchronize_session="fetch")
    else:
        count = db.query(models.Review).filter(models.Review.product_id == product_id).delete(synchronize_session="fetch")
    db.commit()
    return {"message": f"{count} avaliações excluídas com sucesso!", "count": count}

@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to delete a review."""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}

class ReviewUpdate(BaseModel):
    user_name: Optional[str] = None
    comment: Optional[str] = None
    rating: Optional[int] = None
    is_approved: Optional[bool] = None
    product_id: Optional[int] = None
    images: Optional[list[str]] = None

@router.put("/{review_id}")
def update_review(
    review_id: int, 
    data: ReviewUpdate, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(get_current_admin)
):
    """Admin endpoint to update review details, rating, comment, approval status, and images."""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    if data.user_name is not None:
        review.user_name = data.user_name.strip()
    if data.comment is not None:
        review.comment = data.comment.strip()
    if data.rating is not None:
        review.rating = max(1, min(5, data.rating))
    if data.is_approved is not None:
        review.is_approved = data.is_approved
    if data.product_id is not None:
        review.product_id = data.product_id if data.product_id != 0 else None
    if data.images is not None:
        review.images = normalize_images(data.images)

    db.commit()
    db.refresh(review)
    return {
        "message": "Avaliação atualizada com sucesso!",
        "review": {
            "id": review.id,
            "user_name": review.user_name,
            "comment": review.comment,
            "rating": review.rating,
            "images": normalize_images(review.images),
            "is_approved": review.is_approved,
            "product_id": review.product_id,
            "created_at": review.created_at.isoformat() if review.created_at else None
        }
    }

