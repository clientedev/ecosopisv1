from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import models
from pydantic import BaseModel
import os
from groq import Groq
from openai import OpenAI

router = APIRouter()

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

def detect_topic(msg: str) -> str:
    msg_lower = msg.lower()
    if any(w in msg_lower for w in ["acne", "espinha", "cravos", "oleosidade", "oleosa"]):
        return "Acne & Oleosidade"
    elif any(w in msg_lower for w in ["mancha", "clarear", "clareamento", "melasma", "açafrão"]):
        return "Clareamento & Manchas"
    elif any(w in msg_lower for w in ["seca", "hidratação", "ressecada", "pés", "manteiga"]):
        return "Hidratação & Pele Seca"
    elif any(w in msg_lower for w in ["óleo", "oleo", "alecrim", "cabelo", "ricino", "aroma"]):
        return "Óleos & Cuidados Capilares"
    elif any(w in msg_lower for w in ["sabonete", "íntimo", "barbatimão"]):
        return "Higiene Natural & Sabonetes"
    return "Dúvidas Gerais"

@router.post("")
def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        zai_key = os.getenv("ZAI_API_KEY") or os.getenv("Z_API_KEY") or os.getenv("ZHIPU_API_KEY")
        xai_key = os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")

        system_prompt = get_product_context(db)

        # 1. Z.AI (z.ai / ZhipuAI / Z-Code)
        if zai_key or (groq_key and ("z.ai" in groq_key.lower() or groq_key.startswith("zai-"))):
            api_key = zai_key or groq_key
            base_url = os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4")
            client = OpenAI(
                api_key=api_key,
                base_url=base_url
            )
            model_name = os.getenv("ZAI_MODEL", "glm-4-flash")
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    max_tokens=350,
                    temperature=0.7,
                )
            except Exception as model_err:
                print(f"Z.AI failed with model '{model_name}': {model_err}. Trying fallback 'glm-4'...")
                response = client.chat.completions.create(
                    model="glm-4",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    max_tokens=350,
                    temperature=0.7,
                )

        # 2. xAI Grok (console.x.ai)
        elif xai_key or (groq_key and groq_key.startswith("xai-")):
            api_key = xai_key or groq_key
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.x.ai/v1"
            )
            model_name = os.getenv("XAI_MODEL", "grok-2-1212")
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    max_tokens=350,
                    temperature=0.7,
                )
            except Exception as model_err:
                print(f"xAI failed with model '{model_name}': {model_err}. Trying fallback 'grok-beta'...")
                response = client.chat.completions.create(
                    model="grok-beta",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    max_tokens=350,
                    temperature=0.7,
                )

        # 3. Groq (console.groq.com)
        elif groq_key:
            client = Groq(api_key=groq_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.message}
                ],
                max_tokens=350,
                temperature=0.7,
            )
        else:
            raise ValueError("Nenhuma chave de API configurada (ZAI_API_KEY, XAI_API_KEY ou GROQ_API_KEY).")

        bot_reply = response.choices[0].message.content
        topic = detect_topic(request.message)

        # Log interaction in DB
        try:
            interaction = models.LiaInteraction(
                user_message=request.message,
                bot_response=bot_reply,
                topic=topic
            )
            db.add(interaction)
            db.commit()
        except Exception as log_err:
            db.rollback()
            print(f"Failed to log LIA interaction: {log_err}")

        return {"response": bot_reply}

    except Exception as e:
        print(f"Chat AI Error: {e}")
        return {"response": "Desculpe, tive um pequeno problema técnico. Tente novamente em instantes! 🌿"}


