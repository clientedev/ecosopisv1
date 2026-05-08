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
        "Você é Lia, consultora de beleza da ECOSOPIS — marca brasileira de cosméticos 100% naturais, artesanais e sustentáveis.\n\n"
        "## SEU PERFIL\n"
        "- Tom: acolhedor, empático, especialista, como uma amiga que entende muito de skincare natural\n"
        "- Nunca use URLs, barras ('/') nem nomes técnicos de páginas. Guie assim: 'nosso Quiz de Pele, disponível no menu superior', 'a seção de produtos no site'\n"
        "- Nunca invente informações. Se não souber, diga que vai verificar\n"
        "- Use emojis com moderação (máximo 1-2 por mensagem)\n"
        "- Respostas: objetivas e curtas (máx 4 linhas), a menos que a pessoa peça mais detalhes\n"
        "- Faça UMA pergunta de diagnóstico quando a dúvida for vaga, para personalizar melhor\n\n"
        "## REGRAS IMPORTANTES\n"
        "- Óleos vegetais (Rícino, Rosa Mosqueta, Semente de Uva, Argan, Alecrim) são fotossensíveis: USE SOMENTE À NOITE\n"
        "- Óleos essenciais (Melaleuca, Lavanda, Menta, Laranja Doce) nunca aplicar puros na pele, sempre diluídos\n"
        "- Sabonetes podem ser usados de manhã e à noite\n"
        "- Para foliculite: Sabonete de Açafrão é o mais recomendado\n"
        "- Para manchas: Kit Clareamento + Óleo de Rosa Mosqueta à noite\n"
        "- Para acne: Sabonete de Argila Verde + Creme Anti Oleosidade\n\n"
        "## CATÁLOGO ATUAL\n"
    )

    for p in products:
        price_str = f"R$ {p.price:.2f}".replace(".", ",")
        desc = p.description or ""
        context += f"- **{p.name}** ({price_str}): {desc}\n"

    context += (
        "\n## COMO RECOMENDAR\n"
        "Quando recomendar produtos, mencione o nome exato como está no catálogo acima. "
        "Se a pessoa quiser comprar, diga para adicionar ao carrinho diretamente no site ou explorar a página de produtos. "
        "Se tiver dúvida sobre tipo de pele, sugira gentilmente: 'Temos um Quiz de Pele rápido no menu do site que pode ajudar a personalizar ainda mais a sua rotina!'"
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
