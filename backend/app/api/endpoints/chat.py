from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import models
from pydantic import BaseModel
import os
import re
from groq import Groq
from openai import OpenAI

router = APIRouter()

HUMAN_SUPPORT_CTA = "Deseja atendimento humano? Nos chame no WhatsApp +55 11 95155-9212."
WHATSAPP_NUMBER = "+55 11 95155-9212"

class ChatRequest(BaseModel):
    message: str

# Base de conhecimento especializada de cosmetologia e fitoterapia Ecosopis
PRODUCT_KNOWLEDGE = {
    "sabonete-acafrao-dolomita": {
        "ativos": "Açafrão (Cúrcuma), Dolomita, Barbatimão",
        "beneficios": "Tratamento número 1 para foliculite, pelos encravados, acne corporal e uniformização do tom da pele.",
        "modo_de_uso": "Aplicar sobre a pele úmida, massagear suavemente em movimentos circulares. Deixar agir por 3 minutos antes de enxaguar. Uso diário.",
        "dica": "Ideal para virilha, pernas, bumbum, axilas e rosto após depilação ou no barbear."
    },
    "sabonete-clareador-argila-branca": {
        "ativos": "Argila Branca, Dolomita, Aloe Vera",
        "beneficios": "Auxilia no clareamento progressivo e suave de manchas escuras, melasma, axilas, virilhas e marcas de acne. Deixa a pele viçosa e uniforme.",
        "modo_de_uso": "Aplicar na pele úmida, massagear e deixar agir por 3 minutos antes de enxaguar. Uso diário.",
        "dica": "A argila branca tem pH muito próximo ao da pele, clareando sem ressecar nem irritar."
    },
    "sabonete-argila-verde": {
        "ativos": "Argila Verde, Aloe Vera, Óleo de Semente de Uva",
        "beneficios": "Controle potente do excesso de oleosidade, secagem de espinhas ativas e desintoxicação dos poros.",
        "modo_de_uso": "Aplicar no rosto e áreas oleosas úmidas, massagear e enxaguar. Uso diário.",
        "dica": "Excelente para pele mista a oleosa com tendência à acne."
    },
    "sabonete-carvao-ativado": {
        "ativos": "Carvão Ativado Vegetal, Calêndula, Aloe Vera",
        "beneficios": "Detox profundo, desobstrução de poros, remoção de cravos, poluição e toxinas acumuladas.",
        "modo_de_uso": "Aplicar no rosto úmido, massageando com foco na zona T (nariz, queixo e testa). Enxaguar.",
        "dica": "O carvão ativado atua como um ímã natural contra a poluição do dia a dia."
    },
    "sabonete-rosa-mosqueta-argila-rosa": {
        "ativos": "Rosa Mosqueta Rubiginosa, Argila Rosa",
        "beneficios": "Hidratação profunda, regeneração celular, melhora da elasticidade e maciez para peles delicadas.",
        "modo_de_uso": "Aplicar na pele úmida com movimentos suaves e enxaguar. Uso diário.",
        "dica": "Perfeito para peles secas, maduras, sensíveis ou sensibilizadas por procedimentos."
    },
    "sabonete-intimo-barbatimao": {
        "ativos": "Extrato concentrado de Barbatimão, Calêndula",
        "beneficios": "Cuidado íntimo diário, proteção natural, ação antisséptica suave, conforto e equilíbrio da microbiota íntima.",
        "modo_de_uso": "Aplicar na região íntima externa durante o banho, massagear suavemente e enxaguar completamente.",
        "dica": "Fórmula segura com pH equilibrado tanto para mulheres quanto para homens."
    },
    "sabonete-liquido-barbatimao": {
        "ativos": "Barbatimão, Calêndula, Óleos Essenciais de Lavanda Francesa e Melaleuca",
        "beneficios": "Limpador multifuncional 3 em 1 (rosto, corpo e região íntima). Limpa sem repuxar, controla acne e acalma a pele.",
        "modo_de_uso": "Aplicar pequena quantidade na palma das mãos, ensaboar a área úmida e enxaguar. Uso diário.",
        "dica": "Prático, higiênico e com textura líquida super cremosa."
    },
    "oleo-rosa-mosqueta-puro": {
        "ativos": "Óleo vegetal de Rosa Mosqueta Rubiginosa 100% puro prensado a frio",
        "beneficios": "Poderoso regenerador celular, ameniza cicatrizes, manchas de sol/acne, linhas finas e estrias.",
        "modo_de_uso": "Aplicar 2 a 3 gotas na pele limpa e seca à noite, massageando até completa absorção. USO OBRIGATORIAMENTE NOTURNO (fotossensível; usar protetor solar pela manhã).",
        "dica": "Pode ser misturado a cremes hidratantes ou usado nas pontas dos cabelos."
    },
    "oleo-alecrim": {
        "ativos": "Óleo vegetal de Alecrim 100% puro",
        "beneficios": "Estimula a circulação do couro cabeludo, combate a queda e auxilia no crescimento e fortalecimento dos fios.",
        "modo_de_uso": "Aplicar no couro cabeludo fazendo massagem circular 30 min antes da lavagem (umectação), ou à noite.",
        "dica": "Conhecido como o tônico natural da vitalidade e crescimento capilar."
    },
    "oleo-semente-uva": {
        "ativos": "Óleo de Semente de Uva 100% puro",
        "beneficios": "Hidratação leve, rápida absorção, rico em resveratrol e antioxidantes, melhora elasticidade e acalma dermatites.",
        "modo_de_uso": "Aplicar no rosto, corpo ou cabelos à noite.",
        "dica": "Não comedogênico, excelente óleo carreador para diluição de óleos essenciais."
    },
    "oleo-ricino": {
        "ativos": "Óleo de Rícino 100% puro",
        "beneficios": "Fortalece fios quebradiços, estimula sobrancelhas e cílios, sela as cutículas capilares.",
        "modo_de_uso": "Aplicar nas raízes dos cabelos ou nas sobrancelhas antes de dormir.",
        "dica": "Textura densa e riquíssima em ácido ricinoleico."
    },
    "oe-lavanda": {
        "ativos": "Óleo essencial de Lavanda Francesa 100% puro",
        "beneficios": "Calmante natural, combate ansiedade e insônia, acalma pequenas irritações na pele.",
        "modo_de_uso": "NUNCA puro na pele. Diluir 1-2 gotas em óleo carreador ou usar no difusor de ambiente.",
        "dica": "O óleo essencial mais versátil e relaxante da aromaterapia."
    },
    "oe-melaleuca": {
        "ativos": "Óleo essencial de Melaleuca (Tea Tree) 100% puro",
        "beneficios": "Ação antibacteriana e antifúngica potente, seca espinhas pontuais e combate micoses.",
        "modo_de_uso": "Sempre diluído em óleo carreador. Para espinhas isoladas, 1 gota diluída pontualmente à noite.",
        "dica": "Potente antisséptico botânico."
    },
    "creme-oleosidade-acne": {
        "ativos": "Calêndula, Chá Verde, Óleo de Semente de Uva, Vitamina E",
        "beneficios": "Hidratante facial leve com toque seco, reduz a vermelhidão e previne novas espinhas sem ressecar.",
        "modo_de_uso": "Aplicar quantidade pequena no rosto limpo e seco pela manhã e/ou noite.",
        "dica": "Pele oleosa precisa de hidratação botânica equilibrada para evitar o efeito rebote!"
    },
    "creme-pes-de-anjo": {
        "ativos": "Barbatimão, Aloe Vera, Copaíba, Ureia",
        "beneficios": "Recuperação profunda de calcanhares rachados, ressecamento extremo e asperezas nos pés.",
        "modo_de_uso": "Aplicar nos pés limpos e secos antes de dormir. Se desejar, colocar meias de algodão para potencializar.",
        "dica": "Resultados visíveis nos primeiros dias de uso regular."
    },
    "desodorante-clareador-solido": {
        "ativos": "Argila Branca, Hidróxido de Magnésio, Manteiga de Karité (100% livre de alumínio e bicarbonato agressivo)",
        "beneficios": "Neutraliza odores por 24h, não bloqueia a transpiração saudável, clareia axilas escurecidas e não mancha roupas.",
        "modo_de_uso": "Passar suavemente nas axilas limpas e secas.",
        "dica": "Perfeito para quem deseja se desintoxicar dos antitranspirantes químicos convencionais."
    },
    "kit-clareamento": {
        "ativos": "Sabonete Super Clareador + Óleo de Rosa Mosqueta Rubiginosa",
        "beneficios": "Dupla definitiva para uniformizar manchas de acne, melasma e áreas escuras.",
        "modo_de_uso": "Lavar com o sabonete diariamente (deixar agir 3 min) e aplicar o óleo de rosa mosqueta à noite.",
        "dica": "O kit mais procurado para clareamento natural da Ecosopis."
    },
    "kit-acafrao-argila": {
        "ativos": "Sabonete de Açafrão & Dolomita + Sabonete Super Clareador",
        "beneficios": "Tratamento completo para foliculite e manchas simultaneamente.",
        "modo_de_uso": "Alternar o uso diário no banho ou usar açafrão no corpo e argila branca no rosto.",
        "dica": "Combinação favorita das clientes para renovação total da pele."
    }
}


def get_product_context(db: Session) -> str:
    products = db.query(models.Product).filter(models.Product.is_active == True).all()

    context = (
        "Você é Lia, a consultora especialista em beleza natural, cosmetologia botânica e fitoterapia da ECOSOPIS.\n"
        "A ECOSOPIS é uma conceituada marca brasileira de cosméticos 100% naturais, veganos, artesanais e sustentáveis, "
        "livres de sulfatos agressivos, parabenos, silicones, derivados de petróleo e crueldade animal.\n\n"
        "## SEU PERFIL E TOM DE VOZ:\n"
        "- Você é acolhedora, empática, paciente e uma verdadeira amiga especialista em skincare natural.\n"
        "- Fale em português brasileiro impecável, de forma amigável, clara e objetiva (máximo 2 a 3 parágrafos).\n"
        "- Explique de forma simples o porquê científico e botânico dos ingredientes (ex: curcumina desinflama folículos, dolomita remineraliza e clareia, argila verde suga o excesso de sebo).\n"
        "- Quando a dúvida for ampla, faça 1 pergunta de diagnóstico para personalizar a rotina.\n"
        "- Incentive o cliente a adicionar os produtos diretamente ao carrinho no site.\n\n"
        "## REGRAS DE OURO DA ECOSOPIS:\n"
        "- **Foliculite e Pelos Encravados (virilha, pernas, bumbum, barba)**: O produto número 1 é o **Sabonete de Açafrão & Dolomita**. Modo de uso essencial: espalhar na pele úmida, massagear e **deixar a espuma agir por 3 minutos** antes de enxaguar. Uso diário.\n"
        "- **Manchas e Melasma**: Recomende o **Sabonete Clareador de Argila Branca** (deixar agir 3 min) e o **Óleo de Rosa Mosqueta Puro** ou o **Kit Clareamento** completo.\n"
        "- **Acne e Oleosidade**: **Sabonete de Argila Verde** (ou Sabonete de Carvão Ativado para cravos/detox) associado ao **Creme Facial Anti-Oleosidade & Acne** (com calêndula e melaleuca).\n"
        "- **Pele Seca, Madura ou Sensível**: **Sabonete de Rosa Mosqueta & Argila Rosa** e **Óleo de Rosa Mosqueta Rubiginosa**.\n"
        "- **Cuidado Íntimo Diário**: **Sabonete Íntimo de Barbatimão** (em barra ou sabonete líquido 3 em 1), com pH balanceado, ação antisséptica suave e calmante. Uso externo.\n"
        "- **Pés Rachados e Ressecados**: **Creme Pés de Anjo** (com copaíba e ureia, restaurador profundo).\n"
        "- **Desodorante Natural**: **Desodorante Clareador Sólido** (livre de alumínio, não mancha roupas e clareia as axilas).\n"
        "- **Cabelos e Fortalecimento**: **Óleo de Alecrim** (crescimento e circulação no couro cabeludo) e **Óleo de Rícino** (fortalecimento de fios e sobrancelhas).\n"
        "- **ÓLEOS VEGETAIS (Rosa Mosqueta, Alecrim, Rícino, Semente de Uva)**: Fotossensíveis! Aplicar na pele SEMPRE À NOITE e usar protetor solar pela manhã.\n"
        "- **ÓLEOS ESSENCIAIS (Melaleuca, Lavanda, Menta, Laranja)**: 100% puros e concentrados. NUNCA usar puro diretamente na pele — sempre diluir em óleo carreador (como semente de uva) ou em difusor aromático.\n\n"
        "## POLÍTICAS E VANTAGENS DA LOJA:\n"
        "- **Frete Grátis**: Para regiões Sul e Sudeste em compras a partir de R$ 148,90; Demais regiões do Brasil a partir de R$ 248,90.\n"
        "- **Cupom Primeira Compra**: O cupom `PRIMEIRACOMPRA` concede 10% de desconto na primeira compra de varejo.\n"
        "- **Atacado / Revenda**: Desconto de 45% aplicado automaticamente a partir de 10 unidades de sabonetes/produtos de atacado.\n"
        "- **Formas de Pagamento**: PIX (aprovação imediata), Cartão de Crédito em até 3x sem juros (ou até 12x), e o exclusivo **Pagamento Combinado (PIX + Cartão de Crédito na mesma compra)**.\n"
        "- **Compra como Visitante**: O cliente pode finalizar compras tranquilamente sem precisar criar conta antes.\n\n"
        "## REGRA PADRÃO OBRIGATÓRIA DE ENCERRAMENTO:\n"
        "Toda resposta sua deve terminar obrigatoriamente com a oferta de atendimento humano no seguinte padrão:\n"
        "Deseja atendimento humano? Nos chame no WhatsApp +55 11 95155-9212.\n\n"
        "## CATÁLOGO DE PRODUTOS DISPONÍVEIS NA LOJA:\n"
    )

    for p in products:
        price_str = f"R$ {p.price:.2f}".replace(".", ",")
        desc = p.description or ""
        slug = p.slug or ""
        extra = PRODUCT_KNOWLEDGE.get(slug, {})
        ativos_str = f" | Ativos: {extra['ativos']}" if 'ativos' in extra else ""
        beneficios_str = f" | Benefícios: {extra['beneficios']}" if 'beneficios' in extra else ""
        context += f"- **{p.name}** ({price_str}){ativos_str}{beneficios_str} | {desc}\n"

    context += (
        "\n## COMO RECOMENDAR:\n"
        "Mencione os produtos pelos seus nomes exatos em negrito. "
        "Oriente sempre o modo correto de aplicação e lembre que o cliente pode adicionar ao carrinho no site. "
        "E NUNCA se esqueça de fechar com: 'Deseja atendimento humano? Nos chame no WhatsApp +55 11 95155-9212.'"
    )
    return context


def detect_topic(msg: str) -> str:
    msg_lower = msg.lower()
    if any(w in msg_lower for w in ["acne", "espinha", "cravos", "oleosidade", "oleosa"]):
        return "Acne & Oleosidade"
    elif any(w in msg_lower for w in ["mancha", "clarear", "clareamento", "melasma", "açafrão", "acafrao", "foliculite", "virilha"]):
        return "Clareamento & Foliculite"
    elif any(w in msg_lower for w in ["seca", "hidratação", "hidratacao", "ressecada", "pés", "pes", "manteiga"]):
        return "Hidratação & Pele Seca"
    elif any(w in msg_lower for w in ["óleo", "oleo", "alecrim", "cabelo", "ricino", "aroma"]):
        return "Óleos & Cuidados Capilares"
    elif any(w in msg_lower for w in ["sabonete", "íntimo", "intimo", "barbatimão", "barbatimao"]):
        return "Higiene Natural & Sabonetes"
    elif any(w in msg_lower for w in ["frete", "entrega", "prazo", "envio"]):
        return "Frete & Envio"
    elif any(w in msg_lower for w in ["pagamento", "cartão", "pix", "combinado"]):
        return "Pagamentos"
    elif any(w in msg_lower for w in ["humano", "whatsapp", "contato"]):
        return "Atendimento Humano"
    return "Dúvidas Gerais"


def call_groq_chat(api_key: str, system_prompt: str, user_message: str):
    """Dynamically identifies available Groq chat models and executes chat completion."""
    client = Groq(api_key=api_key, max_retries=0)
    
    # Priority list of top Groq models
    priority_order = [
        "qwen/qwen3.8-27b",
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "llama3-8b-8192",
        "mixtral-8x7b-32768",
        "gemma2-9b-it"
    ]
    
    candidate_models = []
    try:
        remote_models = [m.id for m in client.models.list().data if hasattr(m, 'id')]
        # Add preferred models that are available
        for p in priority_order:
            if p in remote_models:
                candidate_models.append(p)
        # Add any other chat-capable models
        for rm in remote_models:
            if rm not in candidate_models and not any(skip in rm.lower() for skip in ["whisper", "guard", "orpheus", "safeguard", "allam"]):
                candidate_models.append(rm)
    except Exception as e:
        print(f"Could not list Groq models dynamically: {e}")
        candidate_models = priority_order

    last_err = None
    for model_name in candidate_models:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=650,
                temperature=0.6,
            )
            print(f"Lia responded using Groq model: {model_name}")
            return response.choices[0].message.content
        except Exception as err:
            last_err = err
            print(f"Groq model '{model_name}' failed: {err}")
            # If authentication failure, don't keep hammering
            if "authentication" in str(err).lower() or "invalid_api_key" in str(err).lower():
                break

    if last_err:
        raise last_err
    raise ValueError("Nenhum modelo Groq disponível respondeu.")


def call_gemini_chat(api_key: str, system_prompt: str, user_message: str):
    """Google Gemini AI Studio via OpenAI-compatible endpoint."""
    client = OpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        max_retries=1
    )
    gemini_models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]
    for m in gemini_models:
        try:
            response = client.chat.completions.create(
                model=m,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=650,
                temperature=0.6,
            )
            print(f"Lia responded using Gemini model: {m}")
            return response.choices[0].message.content
        except Exception as e:
            print(f"Gemini model '{m}' error: {e}")
    raise ValueError("Falha ao comunicar com Gemini")


def call_openai_chat(api_key: str, system_prompt: str, user_message: str):
    """Official OpenAI GPT models."""
    client = OpenAI(api_key=api_key, max_retries=1)
    models_to_try = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
    for m in models_to_try:
        try:
            response = client.chat.completions.create(
                model=m,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=650,
                temperature=0.6,
            )
            print(f"Lia responded using OpenAI model: {m}")
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI model '{m}' error: {e}")
    raise ValueError("Falha ao comunicar com OpenAI")


def call_xai_chat(api_key: str, system_prompt: str, user_message: str):
    """xAI Grok models."""
    client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", max_retries=1)
    models_to_try = [os.getenv("XAI_MODEL", "grok-2-1212"), "grok-beta"]
    for m in models_to_try:
        try:
            response = client.chat.completions.create(
                model=m,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=650,
                temperature=0.6,
            )
            print(f"Lia responded using xAI model: {m}")
            return response.choices[0].message.content
        except Exception as e:
            print(f"xAI model '{m}' error: {e}")
    raise ValueError("Falha ao comunicar com xAI")


def call_zai_chat(api_key: str, system_prompt: str, user_message: str):
    """Zhipu AI (z.ai) client."""
    base_urls = [
        "https://api.z.ai/api/coding/paas/v4",
        "https://api.z.ai/api/paas/v4"
    ]
    for base_url in base_urls:
        try:
            client = OpenAI(api_key=api_key, base_url=base_url, max_retries=1)
            response = client.chat.completions.create(
                model="glm-4-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=500,
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Z.AI failed on {base_url}: {e}")
    raise ValueError("Falha ao comunicar com Z.AI")


def generate_fallback_response(user_msg: str, db: Session) -> str:
    """
    Super smart, product-aware and empathetic fallback response in Lia's persona.
    Used when external LLM APIs are offline or disconnected.
    Always includes the mandatory human WhatsApp support prompt.
    """
    msg = user_msg.lower().strip()
    clean_msg = re.sub(r"[^\w\s]", "", msg)

    # 1. Foliculite e Pelos Encravados
    if any(w in clean_msg for w in ["foliculite", "pelos encravados", "pelo encravado", "depilacao", "depilar", "virilha", "bumbum", "acafrao", "curcuma"]):
        return (
            "Para tratar a foliculite e prevenir pelos encravados (especialmente na virilha, pernas, bumbum ou barba), "
            "o produto número 1 da Ecosopis é o **Sabonete de Açafrão & Dolomita**! 🌿\n\n"
            "O segredo para um resultado incrível está no modo de uso: aplique sobre a pele úmida, massageie suavemente e "
            "**deixe a espuma agir por 3 minutos** antes de enxaguar. O açafrão atua como um potente anti-inflamatório botânico, "
            "enquanto a dolomita acalma e ajuda a uniformizar o tom da pele.\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 2. Manchas e Melasma
    if any(w in clean_msg for w in ["mancha", "manchas", "clarear", "clareamento", "melasma", "axila escura", "virilha escura"]):
        return (
            "Para uniformizar manchas e devolver o viço natural à pele, a nossa recomendação de ouro é o **Kit Clareamento** "
            "(ou o **Sabonete Clareador de Argila Branca** associado ao **Óleo de Rosa Mosqueta Rubiginosa Puro**)! ✨\n\n"
            "A argila branca promove renovação celular suave com pH balanceado. E atenção à dica essencial: use o sabonete diariamente "
            "(deixando agir por 3 minutos) e aplique o Óleo de Rosa Mosqueta **somente à noite**, pois óleos vegetais são fotossensíveis "
            "e atuam durante o sono na regeneração profunda!\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 3. Acne, Oleosidade e Cravos
    if any(w in clean_msg for w in ["acne", "espinha", "espinhas", "cravo", "cravos", "oleosidade", "oleosa", "brilho"]):
        return (
            "Para combater a acne e controlar a oleosidade sem provocar o efeito rebote, recomendamos a dupla perfeita: "
            "o **Sabonete de Argila Verde** (ou o **Sabonete de Carvão Ativado** para detox e desobstrução profunda dos poros) "
            "combinado com o **Creme Facial Anti-Oleosidade & Acne**! 🍃\n\n"
            "Com calêndula e melaleuca, o creme hidrata com toque seco e acalma a vermelhidão das espinhas.\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 4. Higiene Íntima & Barbatimão
    if any(w in clean_msg for w in ["intimo", "intima", "barbatimao", "corrimento", "odor", "coceira", "ph intimo"]):
        return (
            "Para a saúde e o cuidado íntimo diário, nós desenvolvemos o consagrado **Sabonete Íntimo de Barbatimão & Calêndula** "
            "(disponível em barra e também na prática versão líquida 3 em 1)! 🌸\n\n"
            "O extrato botânico de barbatimão oferece ação antisséptica suave, equilibra a microbiota e previne odores e desconfortos, "
            "mantendo a proteção natural da região externa com frescor e suavidade.\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 5. Pés Rachados e Ressecamento Extremo
    if any(w in clean_msg for w in ["pe", "pes", "rachadura", "rachaduras", "calcanhar", "calcanhares"]):
        return (
            "Para pés ásperos ou calcanhares com rachaduras, o nosso **Creme para Rachaduras – Pés de Anjo** é simplesmente transformador! 🦶✨\n\n"
            "Sua fórmula com Barbatimão, Copaíba e Ureia restaura a derme profundamente. Aplique à noite massageando bem os pés limpos e secos "
            "— nos primeiros dias você já sentirá a maciez.\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 6. Desodorante Natural e Axilas
    if any(w in clean_msg for w in ["desodorante", "suor", "odor axila", "antitranspirante", "aluminio"]):
        return (
            "O nosso **Desodorante Clareador Sólido** é 100% natural, formulado com Argila Branca, Hidróxido de Magnésio e Manteiga de Karité! 🌿\n\n"
            "Ele é totalmente livre de alumínio e bicarbonato abrasivo, permitindo que suas axilas transpirem saudavelmente enquanto neutraliza "
            "completamente as bactérias do odor por 24 horas e auxilia no clareamento progressivo da pele.\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 7. Cuidados Capilares, Queda e Crescimento
    if any(w in clean_msg for w in ["cabelo", "cabelos", "queda", "crescimento", "alecrim", "ricino", "couro cabeludo", "umectacao"]):
        return (
            "Para fios fortes e couro cabeludo saudável, nossos aliados botânicos são o **Óleo Vegetal de Alecrim 100% Puro** "
            "(que ativa a microcirculação e acelera o crescimento dos fios) e o **Óleo de Rícino** (que fortalece e engrossa os fios e sobrancelhas). 💧\n\n"
            "Para umectação, aplique algumas gotas nas raízes massageando em círculos 30 minutos antes do banho.\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 8. Pele Seca, Madura ou Sensível
    if any(w in clean_msg for w in ["pele seca", "ressecada", "madura", "sensivel", "linhas", "rugas", "envelhecimento"]):
        return (
            "Para recuperar a elasticidade e o viço de peles secas, maduras ou sensíveis, o **Sabonete de Rosa Mosqueta & Argila Rosa** "
            "limpa suavemente sem ressecar. Para a noite, o **Óleo de Rosa Mosqueta Rubiginosa Puro** proporciona nutrição intensiva e renovação celular profunda! 🌹\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 9. Frete, Entrega e Prazos
    if any(w in clean_msg for w in ["frete", "entrega", "prazo", "enviar", "envio", "rastreio"]):
        return (
            "Trabalhamos com envio seguro para todo o Brasil via Melhor Envio (Correios e Jadlog)! 📦\n\n"
            "✨ **Frete Grátis:**\n"
            "- Sul e Sudeste: compras a partir de **R$ 148,90**\n"
            "- Demais regiões: compras a partir de **R$ 248,90**\n\n"
            "Você pode calcular o prazo exato inserindo seu CEP diretamente no carrinho!\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 10. Pagamento e Pagamento Combinado
    if any(w in clean_msg for w in ["pagamento", "pagar", "cartao", "cartão", "pix", "parcela", "parcelamento", "combinado"]):
        return (
            "Facilitamos seu pedido com várias opções seguras de pagamento: 💳\n\n"
            "- **PIX:** com aprovação imediata;\n"
            "- **Cartão de Crédito:** em até 3x sem juros (ou até 12x);\n"
            "- **Pagamento Combinado (PIX + Cartão):** novidade exclusiva da Ecosopis, onde você pode dividir o valor da mesma compra entre PIX e Cartão de Crédito!\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 11. Cupons e Atacado
    if any(w in clean_msg for w in ["cupom", "desconto", "primeiracompra", "atacado", "revenda"]):
        return (
            "Aproveite as nossas vantagens especiais: 🎁\n\n"
            "- **Cupom PRIMEIRACOMPRA:** ganhe 10% de desconto no seu primeiro pedido de varejo;\n"
            "- **Atacado Ecosopis:** comprando a partir de 10 unidades de sabonetes/atacado, você ganha **45% de desconto** automático no carrinho para revender ou abastecer seu estoque!\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 12. Atendimento Humano direto
    if any(w in clean_msg for w in ["humano", "atendente", "falar com pessoa", "whatsapp", "suporte"]):
        return (
            "Com certeza! Será um prazer conectar você com a nossa equipe humana de especialistas. "
            "Estamos prontos no WhatsApp para tirar qualquer dúvida, ajudar a montar sua rotina ou acompanhar seus pedidos!\n\n"
            f"💬 {HUMAN_SUPPORT_CTA}"
        )

    # 13. Busca de produtos no banco de dados local
    try:
        products = db.query(models.Product).filter(models.Product.is_active == True).all()
        for p in products:
            p_name_clean = re.sub(r"[^\w\s]", "", (p.name or "").lower())
            tokens = [t for t in p_name_clean.split() if len(t) > 3]
            if any(t in clean_msg for t in tokens):
                price_str = f"R$ {p.price:.2f}".replace(".", ",")
                return (
                    f"Recomendo o nosso **{p.name}** ({price_str})! {p.description or 'Excelente cosmético 100% natural para a sua rotina.'}\n\n"
                    "Você pode adicioná-lo diretamente ao seu carrinho no site. "
                    f"Se quiser conferir outros itens, explore a seção de produtos!\n\n"
                    f"💬 {HUMAN_SUPPORT_CTA}"
                )
    except Exception:
        pass

    # Resposta padrão inteligente
    return (
        "Olá! Sou a Lia, consultora de beleza natural da ECOSOPIS. 🌿 Nossos cosméticos são 100% naturais, artesanais, "
        "veganos e livres de químicos agressivos.\n\n"
        "Como posso te ajudar a cuidar da sua pele hoje? Se você busca tratar foliculite, manchas, oleosidade ou hidratação, "
        "me conte mais sobre a sua pele que te indico a rotina perfeita!\n\n"
        f"💬 {HUMAN_SUPPORT_CTA}"
    )


@router.post("")
def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    bot_reply = None
    topic = detect_topic(request.message)

    try:
        groq_key = os.getenv("GROQ_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        xai_key = os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")
        zai_key = os.getenv("ZAI_API_KEY") or os.getenv("Z_API_KEY") or os.getenv("ZHIPU_API_KEY")
        use_ollama = os.getenv("USE_OLLAMA", "").lower() in ["true", "1", "yes"] or os.getenv("OLLAMA_HOST")

        system_prompt = get_product_context(db)

        # 1. Groq (Prioritário - velocidade ultrarrápida e modelos de ponta como Qwen 27B / Llama 3.3)
        if not bot_reply and groq_key and not groq_key.startswith("xai-") and not groq_key.startswith("zai-"):
            try:
                bot_reply = call_groq_chat(groq_key, system_prompt, request.message)
            except Exception as groq_err:
                print(f"Groq API Error: {groq_err}")

        # 2. Google Gemini (se disponível no ambiente)
        if not bot_reply and gemini_key:
            try:
                bot_reply = call_gemini_chat(gemini_key, system_prompt, request.message)
            except Exception as gemini_err:
                print(f"Gemini API Error: {gemini_err}")

        # 3. OpenAI (se disponível no ambiente)
        if not bot_reply and openai_key:
            try:
                bot_reply = call_openai_chat(openai_key, system_prompt, request.message)
            except Exception as openai_err:
                print(f"OpenAI API Error: {openai_err}")

        # 4. xAI Grok (se disponível)
        if not bot_reply and (xai_key or (groq_key and groq_key.startswith("xai-"))):
            try:
                bot_reply = call_xai_chat(xai_key or groq_key, system_prompt, request.message)
            except Exception as xai_err:
                print(f"xAI API Error: {xai_err}")

        # 5. Z.AI (se disponível)
        if not bot_reply and (zai_key or (groq_key and groq_key.startswith("zai-"))):
            try:
                bot_reply = call_zai_chat(zai_key or groq_key, system_prompt, request.message)
            except Exception as zai_err:
                print(f"Z.AI API Error: {zai_err}")

        # 6. Ollama Local Llama (se configurado)
        if not bot_reply and use_ollama:
            try:
                ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
                model_name = os.getenv("OLLAMA_MODEL", "llama3.2")
                client = OpenAI(api_key="ollama", base_url=ollama_url, max_retries=1)
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    max_tokens=500,
                    temperature=0.6,
                )
                bot_reply = response.choices[0].message.content
                print("Lia responded using Local Ollama.")
            except Exception as ollama_err:
                print(f"Ollama local error: {ollama_err}")

        # 7. Fallback Inteligente Local (100% Garantido com conhecimento de catálogo e fitoterapia)
        if not bot_reply:
            print("Using Intelligent Local Catalog Fallback for Lia.")
            bot_reply = generate_fallback_response(request.message, db)

        # Regra de ouro incondicional: Garante que o número de WhatsApp e atendimento humano constem na resposta
        if bot_reply:
            clean_reply = bot_reply.strip()
            if "95155-9212" not in clean_reply:
                bot_reply = f"{clean_reply}\n\n💬 {HUMAN_SUPPORT_CTA}"

        # Registra interação no banco para histórico e analytics
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
        print(f"Chat AI Critical Error: {e}")
        fallback_reply = generate_fallback_response(request.message, db)
        return {"response": fallback_reply}
