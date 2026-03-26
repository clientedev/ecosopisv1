from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.melhorenvio_service import MelhorEnvioV2Service

router = APIRouter()

class FreightRequestModel(BaseModel):
    cep_destino: str
    peso: float
    comprimento: int
    altura: int
    largura: int

@router.post("/frete/calcular")
async def calculate_freight(request: FreightRequestModel):
    """
    Calcula frete enviando:
    - CEP destino
    - peso, dimensões
    (O CEP origem é fixo no service conforme solicitado = 02969000)
    """
    try:
        opcoes = MelhorEnvioV2Service.calcular_frete(
            cep_destino=request.cep_destino,
            peso=request.peso,
            comprimento=request.comprimento,
            altura=request.altura,
            largura=request.largura
        )
        return {"opcoes": opcoes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao calcular frete: {str(e)}")
