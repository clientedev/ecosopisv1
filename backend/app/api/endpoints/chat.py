from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import models
from pydantic import BaseModel
import os
from groq import Groq

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class ChatRequest(BaseModel):
    message: str

def get_product_context(db: Session) -> str:
    products = db.query(models.Product).filter(models.Product.is_active == True).all()
    context = (
        "Você é Lia, a consultora de beleza da ECOSOPIS — uma loja de cosméticos artesanais, 100% naturais e sustentáveis. "
        "Seu tom é caloroso, profissional, empático e entusiasmado com cosmética natural. "
        "Conheça os produtos disponíveis no catálogo:\n\n"
    )
    for p in products:
        context += f"- **{p.name}**: R$ {p.price:.2f}. {p.description or ''}\n"

    context += (
        "\nSempre responda de forma gentil e baseada no catálogo acima. "
        "Mencione os benefícios naturais dos produtos quando pertinente. "
        "Se o cliente não souber o que quer, sugira o Quizz de Pele (/quizz) para uma recomendação personalizada. "
        "Respostas curtas e objetivas, máximo de 3 linhas a não ser que o cliente peça mais detalhes."
    )
    return context

@router.post("")
def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        client = Groq(api_key=GROQ_API_KEY)
        system_prompt = get_product_context(db)

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ],
            max_tokens=350,
            temperature=0.7,
        )

        return {"response": response.choices[0].message.content}

    except Exception as e:
        print(f"Groq Chat Error: {e}")
        return {"response": "Desculpe, tive um pequeno problema técnico. Tente novamente em instantes! 🌿"}
