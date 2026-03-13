from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.core.melhorenvio_service import MelhorEnvioService

router = APIRouter()

class ShippingItem(BaseModel):
    id: Optional[str] = "1"
    width: float
    height: float
    length: float
    weight: float
    price: float
    quantity: int

class ShippingRequest(BaseModel):
    dest_cep: str
    items: List[ShippingItem]

@router.post("/calculate")
async def calculate_shipping(request: ShippingRequest):
    """
    Calcula opções de frete reais via Melhor Envio.
    """
    # Converte Pydantic items para dicts
    items_dict = [item.model_dump() for item in request.items]
    
    options = MelhorEnvioService.calculate_shipping(request.dest_cep, items_dict)
    
    if not options:
        # Fallback ou erro se nada for retornado (ex: CEP inválido)
        return []
        
    return options
