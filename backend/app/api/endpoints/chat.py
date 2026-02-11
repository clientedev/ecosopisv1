from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import models
from pydantic import BaseModel
import os
from openai import OpenAI
from typing import List

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

def get_product_context(db: Session):
    products = db.query(models.Product).all()
    context = "Você é a consultora de beleza da ECOSOPIS, uma loja de cosméticos artesanais e 100% naturais. "
    context += "Aqui estão os produtos disponíveis no catálogo:\n\n"
    
    for p in products:
        context += f"- {p.name}: R$ {p.price}. {p.description or ''}\n"
    
    context += "\nResponda de forma gentil, profissional e baseada nesses produtos. "
    context += "Sempre incentive o uso de produtos naturais e mencione os benefícios para a pele."
    context += "Se não souber a resposta ou o produto não estiver na lista, indique o nosso Quizz de Pele (/quizz) para uma recomendação personalizada."
    
    return context

@router.post("")
def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        # Fallback for when no API key is set yet, so the UI doesn't break
        return {"response": "Olá! No momento estou em modo de manutenção técnica (configuração de API). Por favor, consulte nosso Quizz de Pele para recomendações!"}

    client = OpenAI(api_key=api_key)
    # Note: If using Gemini with OpenAI compatibility, the base_url would be set.
    # For now, we assume standard OpenAI or a compatible environment variable.
    
    try:
        system_prompt = get_product_context(db)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo", # Default to a common model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ],
            max_tokens=300
        )
        
        return {"response": response.choices[0].message.content}
    except Exception as e:
        print(f"Error in AI Chat: {e}")
        return {"response": "Desculpe, tive um pequeno problema técnico. Posso te ajudar com algo mais sobre nossos produtos naturais?"}
