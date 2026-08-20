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

def call_zai_chat(api_key: str, system_prompt: str, user_message: str):
    # Try both Base URLs: Coding Plan (/coding/paas/v4) vs General API (/paas/v4)
    base_urls = []
    custom_url = os.getenv("ZAI_BASE_URL")
    if custom_url:
        base_urls.append(custom_url)
    base_urls.extend([
        "https://api.z.ai/api/coding/paas/v4",
        "https://api.z.ai/api/paas/v4"
    ])

    # Remove duplicates preserving order
    seen_urls = set()
    unique_base_urls = []
    for u in base_urls:
        if u not in seen_urls:
            seen_urls.add(u)
            unique_base_urls.append(u)

    last_error = None

    for base_url in unique_base_urls:
        try:
            client = OpenAI(api_key=api_key, base_url=base_url, max_retries=1)

            # 1. Discover models available for this key/account
            candidate_models = []
            custom_model = os.getenv("ZAI_MODEL")
            if custom_model:
                candidate_models.append(custom_model)

            try:
                m_list = client.models.list()
                fetched_models = [m.id for m in m_list.data if hasattr(m, 'id')]
                print(f"Z.AI [{base_url}] fetched models: {fetched_models}")
                candidate_models.extend(fetched_models)
            except Exception as list_err:
                print(f"Could not list models from Z.AI [{base_url}]: {list_err}")

            # Standard model candidates
            candidate_models.extend([
                "glm-5.3", "glm-5-turbo", "glm-4.7", "glm-4-air",
                "glm-4-plus", "glm-4", "glm-4-flash", "codegeex-4"
            ])

            # Deduplicate preserving order
            seen = set()
            unique_models = []
            for m in candidate_models:
                if m and m not in seen:
                    seen.add(m)
                    unique_models.append(m)

            for model_name in unique_models:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message}
                        ],
                        max_tokens=350,
                        temperature=0.7,
                    )
                    print(f"Z.AI succeeded with base_url={base_url}, model={model_name}")
                    return response
                except Exception as model_err:
                    last_error = model_err
                    err_msg = str(model_err)
                    print(f"Z.AI failed with base_url={base_url}, model={model_name}: {err_msg}")
                    # If error is insufficient balance (1113), break out to next base_url
                    if "1113" in err_msg or "Insufficient balance" in err_msg:
                        print(f"Base URL {base_url} returned Insufficient Balance (1113). Switching endpoint...")
                        break

        except Exception as client_err:
            last_error = client_err
            print(f"Z.AI client failed on base_url={base_url}: {client_err}")

    if last_error:
        raise last_error
    raise ValueError("Falha ao comunicar com Z.AI")


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
            response = call_zai_chat(api_key, system_prompt, request.message)

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


