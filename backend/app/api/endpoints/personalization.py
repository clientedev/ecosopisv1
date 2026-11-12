"""
Simulador "Personalize seu Produto" (tela Experiências).

- Leitura pública: catálogo real (fotografias dos produtos) + áreas personalizáveis configuradas.
- Escrita (admin): marcação visual da área (4 cantos), curvatura, proporção, rótulo a cobrir.
A composição da arte sobre a foto acontece 100% no navegador (Canvas); nada é gerado por IA paga.
"""
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_admin
from app.core.database import get_db
from app.models import models

router = APIRouter()

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _polygon_area(quad: List[List[float]]) -> float:
    s = 0.0
    for i in range(4):
        x1, y1 = quad[i]
        x2, y2 = quad[(i + 1) % 4]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


class AreaIn(BaseModel):
    product_id: int
    image_url: str = Field(min_length=1, max_length=2048)
    name: str = Field(default="Área principal", min_length=1, max_length=80)
    is_active: bool = True
    quad: List[List[float]]
    curvature: float = 0.0
    aspect_ratio: Optional[float] = None
    cover_label: bool = False
    base_color: Optional[str] = None

    @field_validator("quad")
    @classmethod
    def _quad(cls, v):
        if len(v) != 4 or any(len(p) != 2 for p in v):
            raise ValueError("A área precisa de 4 cantos [x, y].")
        for x, y in v:
            if not (-0.02 <= x <= 1.02 and -0.02 <= y <= 1.02):
                raise ValueError("Os cantos devem estar dentro da fotografia.")
        v = [[min(1.0, max(0.0, float(x))), min(1.0, max(0.0, float(y)))] for x, y in v]
        if _polygon_area(v) < 0.0005:
            raise ValueError("A área marcada é pequena demais.")
        return v

    @field_validator("curvature")
    @classmethod
    def _curv(cls, v):
        return min(1.0, max(0.0, float(v)))

    @field_validator("aspect_ratio")
    @classmethod
    def _aspect(cls, v):
        if v is None:
            return None
        v = float(v)
        if not (0.05 <= v <= 20):
            raise ValueError("Proporção inválida.")
        return v

    @field_validator("base_color")
    @classmethod
    def _color(cls, v):
        if v in (None, ""):
            return None
        if not HEX_COLOR.match(v):
            raise ValueError("Cor inválida (use #rrggbb).")
        return v.lower()


def _area_out(a: models.PersonalizationArea) -> dict:
    return {
        "id": a.id,
        "product_id": a.product_id,
        "image_url": a.image_url,
        "name": a.name,
        "is_active": bool(a.is_active),
        "quad": a.quad,
        "curvature": a.curvature or 0.0,
        "aspect_ratio": a.aspect_ratio,
        "cover_label": bool(a.cover_label),
        "base_color": a.base_color,
    }


def _product_photos(p: models.Product) -> List[str]:
    photos: List[str] = []
    for u in ([p.image_url] if p.image_url else []) + list(p.images or []):
        if u and u not in photos:
            photos.append(u)
    return photos


@router.get("/products")
def list_personalizable_products(db: Session = Depends(get_db), include_inactive_areas: bool = False):
    """Catálogo real (produtos ativos) com fotografias, categoria, descrição e áreas configuradas."""
    products = (
        db.query(models.Product)
        .filter(models.Product.is_active == True)  # noqa: E712
        .order_by(models.Product.order.asc(), models.Product.id.asc())
        .all()
    )
    areas = db.query(models.PersonalizationArea).all()
    by_product = {}
    for a in areas:
        if a.is_active or include_inactive_areas:
            by_product.setdefault(a.product_id, []).append(_area_out(a))
    out = []
    for p in products:
        photos = _product_photos(p)
        if not photos:
            continue
        pa = [a for a in by_product.get(p.id, []) if a["image_url"] in photos]
        out.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "category": p.category,
            "description": p.description,
            "photos": photos,
            "areas": pa,
            "customizable": len(pa) > 0,
        })
    return out


@router.get("/areas")
def list_areas(product_id: Optional[int] = None, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    q = db.query(models.PersonalizationArea)
    if product_id is not None:
        q = q.filter(models.PersonalizationArea.product_id == product_id)
    return [_area_out(a) for a in q.order_by(models.PersonalizationArea.id.asc()).all()]


def _check_photo(db: Session, data: AreaIn):
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    if data.image_url not in _product_photos(product):
        raise HTTPException(status_code=400, detail="Essa fotografia não pertence ao produto.")


@router.post("/areas", status_code=201)
def create_area(data: AreaIn, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    _check_photo(db, data)
    area = models.PersonalizationArea(**data.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)
    return _area_out(area)


@router.put("/areas/{area_id}")
def update_area(area_id: int, data: AreaIn, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    area = db.query(models.PersonalizationArea).filter(models.PersonalizationArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área não encontrada.")
    _check_photo(db, data)
    for k, v in data.model_dump().items():
        setattr(area, k, v)
    db.commit()
    db.refresh(area)
    return _area_out(area)


@router.delete("/areas/{area_id}")
def delete_area(area_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    area = db.query(models.PersonalizationArea).filter(models.PersonalizationArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área não encontrada.")
    db.delete(area)
    db.commit()
    return {"ok": True}
