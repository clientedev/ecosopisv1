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
from sqlalchemy import or_
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


SIM_CATEGORY = "Embalagens (simulador)"  # itens só do simulador (ex.: sacola); ficam ocultos da loja
SIM_LABEL = "Embalagens"
ALLOWED_PHOTO_PREFIXES = ("/api/images/", "/experiencias/")  # fotos enviadas ao painel ou fotos de kit do site

_ROUND_WORDS = ("frasco", "shampoo", "condicionador", "óleo", "oleo", "body splash", "splash", "spray", "hidratante",
                "creme", "loção", "locao", "perfume", "garrafa", "pote", "gel", "sérum", "serum", "tônico", "tonico", "refil")


def _auto_quad_curv(name: str, category: Optional[str]):
    """Posição inicial sugerida (sem configuração do admin): o cliente ainda ajusta tudo no simulador."""
    text = f"{name or ''} {category or ''}".lower()
    if any(w in text for w in ("sacola", "caixa", "kit", "embalagem", "sachê", "sache", "bag")):
        return [[0.25, 0.30], [0.75, 0.30], [0.75, 0.70], [0.25, 0.70]], 0.0
    if any(w in text for w in _ROUND_WORDS):
        return [[0.32, 0.42], [0.68, 0.42], [0.68, 0.72], [0.32, 0.72]], 0.55
    return [[0.30, 0.35], [0.70, 0.35], [0.70, 0.65], [0.30, 0.65]], 0.0


def _auto_area(p: models.Product, photo: str, idx: int) -> dict:
    quad, curv = _auto_quad_curv(p.name, p.category)
    return {
        "id": -(p.id * 100 + idx + 1),  # id negativo = sugestão automática, ainda não salva
        "product_id": p.id,
        "image_url": photo,
        "name": "Área principal",
        "is_active": True,
        "quad": quad,
        "curvature": curv,
        "aspect_ratio": None,
        "cover_label": False,
        "base_color": None,
        "auto": True,
    }


@router.get("/products")
def list_personalizable_products(db: Session = Depends(get_db), include_inactive_areas: bool = False):
    """Catálogo real (fotos dos produtos). Toda foto já é personalizável: sem configuração do admin usa-se
    uma área padrão sugerida; o admin pode ajustar (ou desativar) por foto."""
    products = (
        db.query(models.Product)
        .filter(or_(models.Product.is_active == True, models.Product.category == SIM_CATEGORY))  # noqa: E712
        .order_by(models.Product.order.asc(), models.Product.id.asc())
        .all()
    )
    saved = {}
    for a in db.query(models.PersonalizationArea).order_by(models.PersonalizationArea.id.asc()).all():
        saved.setdefault(a.product_id, []).append(a)
    out = []
    for p in products:
        photos = _product_photos(p)
        if not photos:
            continue
        mine = [a for a in saved.get(p.id, []) if a.image_url in photos]
        areas, shown = [], []
        for i, photo in enumerate(photos):
            on_photo = [a for a in mine if a.image_url == photo]
            if on_photo:
                act = [_area_out(a) for a in on_photo if a.is_active or include_inactive_areas]
            else:
                act = [_auto_area(p, photo, i)]
            if act:
                areas += act
                shown.append(photo)
        out.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "category": SIM_LABEL if p.category == SIM_CATEGORY else p.category,
            "description": p.description,
            "photos": shown if shown else (photos if include_inactive_areas else []),
            "areas": areas,
            "configured": len(mine) > 0,
            "simulator_only": p.category == SIM_CATEGORY,
            "customizable": len(shown) > 0,
        })
    return out


class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    image_url: str = Field(min_length=1, max_length=2048)
    description: Optional[str] = Field(default=None, max_length=500)


@router.post("/items", status_code=201)
def create_item(data: ItemIn, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Cadastra um item só do simulador (ex.: sacola, caixa) a partir de uma foto já enviada. Não aparece na loja."""
    if not data.image_url.startswith(ALLOWED_PHOTO_PREFIXES):
        raise HTTPException(status_code=400, detail="Envie a foto pelo painel.")
    base = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-") or "item"
    slug, n = f"sim-{base}", 1
    while db.query(models.Product).filter(models.Product.slug == slug).first():
        n += 1
        slug = f"sim-{base}-{n}"
    p = models.Product(
        name=data.name.strip(), slug=slug, description=data.description, category=SIM_CATEGORY,
        image_url=data.image_url, images=[data.image_url], price=0, stock=0, is_active=False, buy_on_site=False,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name}


class ReplacePhoto(BaseModel):
    old_url: str
    new_url: str


class ItemPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    add_photo: Optional[str] = None
    replace_photo: Optional[ReplacePhoto] = None
    remove_photo: Optional[str] = None


def _sim_item(db: Session, product_id: int) -> models.Product:
    p = db.query(models.Product).filter(models.Product.id == product_id, models.Product.category == SIM_CATEGORY).first()
    if not p:
        raise HTTPException(status_code=404, detail="Item do simulador não encontrado.")
    return p


@router.patch("/items/{product_id}")
def patch_item(product_id: int, data: ItemPatch, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Edita um item do simulador: renomear, adicionar/trocar/remover foto (as áreas acompanham a foto trocada)."""
    p = _sim_item(db, product_id)
    photos = _product_photos(p)
    for u in (data.add_photo, data.replace_photo.new_url if data.replace_photo else None):
        if u is not None and not u.startswith(ALLOWED_PHOTO_PREFIXES):
            raise HTTPException(status_code=400, detail="Envie a foto pelo painel.")
    if data.name is not None:
        p.name = data.name.strip()
    if data.description is not None:
        p.description = data.description
    if data.add_photo and data.add_photo not in photos:
        photos.append(data.add_photo)
    if data.replace_photo:
        r = data.replace_photo
        if r.old_url not in photos:
            raise HTTPException(status_code=400, detail="Foto não pertence ao item.")
        photos = [r.new_url if u == r.old_url else u for u in photos]
        db.query(models.PersonalizationArea).filter(
            models.PersonalizationArea.product_id == p.id, models.PersonalizationArea.image_url == r.old_url
        ).update({"image_url": r.new_url})
    if data.remove_photo:
        if data.remove_photo not in photos:
            raise HTTPException(status_code=400, detail="Foto não pertence ao item.")
        if len(photos) <= 1:
            raise HTTPException(status_code=400, detail="O item precisa ter ao menos uma foto. Para apagar tudo, remova o item.")
        photos = [u for u in photos if u != data.remove_photo]
        db.query(models.PersonalizationArea).filter(
            models.PersonalizationArea.product_id == p.id, models.PersonalizationArea.image_url == data.remove_photo
        ).delete()
    p.image_url = photos[0]
    p.images = photos
    db.commit()
    return {"id": p.id, "name": p.name, "photos": photos}


@router.delete("/items/{product_id}")
def delete_item(product_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    p = db.query(models.Product).filter(models.Product.id == product_id, models.Product.category == SIM_CATEGORY).first()
    if not p:
        raise HTTPException(status_code=404, detail="Item do simulador não encontrado.")
    db.query(models.PersonalizationArea).filter(models.PersonalizationArea.product_id == p.id).delete()
    db.delete(p)
    db.commit()
    return {"ok": True}


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
