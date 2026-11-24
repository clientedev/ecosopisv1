"""
Motor de conversa da LIA (Ecosopis) — 100% local, sem chave de API.

Técnicas usadas (todas na biblioteca padrão do Python):
  1. Normalização + stemming leve do português + correção de erros de digitação
     (difflib contra um vocabulário do domínio).
  2. Classificação de intenção por regras ponderadas.
  3. Extração de entidades: queixas de pele/cabelo, tipo de pele, produtos
     (casamento difuso com o catálogo), CEP, quantidades, sinais de segurança
     (gestante, bebê, alergia...).
  4. Recuperação BM25 sobre o catálogo REAL (nome, descrição, ativos, benefícios,
     modo de uso, tags) para perguntas abertas ("tem algo com copaíba?").
  5. Memória de conversa: histórico recente resolve perguntas de continuação
     ("e como eu uso?", "quanto custa?", "e o outro?").
  6. Diálogo guiado: quando a queixa é vaga, faz UMA pergunta de diagnóstico.
  7. Dados vivos: preço promocional atual, estoque, frete grátis por região,
     atacado e cotação real de frete por CEP (via função injetada).
  8. Segurança: nunca diagnostica; orienta procurar profissional quando preciso.

O motor devolve também um nível de confiança; o endpoint pode usar um LLM
opcional apenas quando a confiança é baixa (e só se houver chave configurada).
"""
from __future__ import annotations

import difflib
import hashlib
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple

FREE_SHIPPING_SOUTH_SOUTHEAST = 148.90
FREE_SHIPPING_OTHER_REGIONS = 248.90
WHOLESALE_MIN_UNITS = 10
WHOLESALE_FACTOR = 0.55  # 45% OFF


# ───────────────────────────── utilidades de texto ─────────────────────────────
def norm(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s$,.\-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def words(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", norm(text))


def stem(w: str) -> str:
    if len(w) <= 3:
        return w
    for suf in ("mente", "zinho", "zinha", "inho", "inha", "coes", "oes", "aes"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            w = w[: -len(suf)] + ("cao" if suf == "coes" else "")
            break
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        w = w[:-1]
    return w


STOPWORDS = set(
    "a o as os um uma uns umas de da do das dos em no na nos nas por para pra com sem e ou que "
    "qual quais quem como me te se eu voce vc tu meu minha meus minhas seu sua isso isto esse essa "
    "esses essas este esta aquele aquela ao aos ha tem tenho ter quero queria gostaria pode podem "
    "mais muito muita bem so ja la ai aqui ate sobre entre mas pois porque ser sao foi era ta to "
    "oi ola favor por favor".split()
)


def fmt_brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ───────────────────────────── catálogo ─────────────────────────────
@dataclass
class Item:
    id: int
    name: str
    slug: str
    price: float
    sale_price: Optional[float] = None
    on_sale: bool = False
    stock: Optional[int] = None
    category: str = ""
    tags: List[str] = field(default_factory=list)
    description: str = ""
    ingredients: str = ""
    benefits: str = ""
    modo_de_uso: str = ""
    cuidados: str = ""
    contraindicacoes: str = ""
    observacoes: str = ""
    curiosidades: str = ""
    is_wholesale: bool = False

    @property
    def eff_price(self) -> float:
        if self.on_sale and self.sale_price and self.sale_price > 0:
            return float(self.sale_price)
        return float(self.price or 0)

    @property
    def available(self) -> bool:
        return self.stock is None or self.stock > 0

    @property
    def is_kit(self) -> bool:
        return self.slug.startswith("kit") or norm(self.name).startswith("kit")

    def text_blob(self) -> str:
        return " ".join(
            [self.name, self.name, self.description, self.ingredients, self.benefits,
             self.modo_de_uso, self.curiosidades, " ".join(self.tags), self.category]
        )


def load_catalog(db) -> List[Item]:
    """Lê produtos ativos + detalhes do banco."""
    from app.models import models  # import tardio: evita ciclo em testes

    out: List[Item] = []
    for p in db.query(models.Product).filter(models.Product.is_active == True).all():  # noqa: E712
        d = getattr(p, "details", None)
        out.append(
            Item(
                id=p.id, name=p.name or "", slug=p.slug or "", price=float(p.price or 0),
                sale_price=float(p.sale_price) if p.sale_price else None,
                on_sale=bool(p.is_on_sale), stock=p.stock, category=p.category or "",
                tags=list(p.tags or []), description=p.description or "",
                ingredients=p.ingredients or "", benefits=p.benefits or "",
                modo_de_uso=(d.modo_de_uso if d else "") or "",
                cuidados=(d.cuidados if d else "") or "",
                contraindicacoes=(d.contraindicacoes if d else "") or "",
                observacoes=(d.observacoes if d else "") or "",
                curiosidades=(d.curiosidades if d else "") or "",
                is_wholesale=bool(p.is_wholesale),
            )
        )
    return out


# ───────────────────────────── BM25 ─────────────────────────────
class BM25:
    def __init__(self, docs: Sequence[Sequence[str]], k1: float = 1.4, b: float = 0.75):
        self.docs = [list(d) for d in docs]
        self.k1, self.b = k1, b
        self.N = len(self.docs)
        self.avgdl = (sum(len(d) for d in self.docs) / self.N) if self.N else 0.0
        df: Counter = Counter()
        for d in self.docs:
            df.update(set(d))
        self.idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()}
        self.tf = [Counter(d) for d in self.docs]

    def score(self, query: Sequence[str], i: int) -> float:
        s, dl = 0.0, len(self.docs[i]) or 1
        for t in query:
            f = self.tf[i].get(t, 0)
            if not f:
                continue
            s += self.idf.get(t, 0) * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1)))
        return s

    def rank(self, query: Sequence[str]) -> List[Tuple[int, float]]:
        r = [(i, self.score(query, i)) for i in range(self.N)]
        return sorted([x for x in r if x[1] > 0], key=lambda x: -x[1])


# ───────────────────────────── conhecimento de domínio ─────────────────────────────
# Queixas: palavras-chave, produtos (por slug, em ordem de prioridade), explicação,
# rotina e cuidados. Nada aqui promete cura: a LIA fala em "auxilia/ajuda".
CONCERNS: Dict[str, dict] = {
    "foliculite": {
        "label": "foliculite e pelos encravados",
        "kw": ["foliculite", "pelo encravado", "pelos encravados", "encravado", "encravar", "bolinha depilacao",
               "bolinhas depilacao", "irritacao depilacao", "pos depilacao", "pos barba", "barba encravada", "virilha irritada",
               "depilacao", "depilar", "barbear", "foliculit", "virilha"],
        "slugs": ["sabonete-acafrao-dolomita", "kit-acafrao-argila", "oleo-semente-uva", "oe-melaleuca"],
        "why": "o açafrão (cúrcuma) tem ação anti-inflamatória e a dolomita ajuda a acalmar e uniformizar a pele",
        "routine": [
            "No banho: espalhe o sabonete na pele úmida, massageie e **deixe a espuma agir por 3 minutos** antes de enxaguar (uso diário).",
            "Depois do banho, com a pele seca, hidrate com poucas gotas de óleo leve (semente de uva) para manter a pele macia.",
            "Evite esfoliar com força e não arranque pelos encravados com pinça.",
        ],
        "tip": "Funciona bem na virilha, pernas, bumbum, axilas e barba — sempre com a espuma agindo 3 minutos.",
        "doctor": "Se houver pus, dor forte, febre ou as lesões piorarem, procure um dermatologista.",
    },
    "acne": {
        "label": "acne e espinhas",
        "kw": ["acne", "espinha", "espinhas", "cravo", "cravos", "acneica", "acneico", "espinhas ativas"],
        "slugs": ["kit-acne", "sabonete-argila-verde", "creme-oleosidade-acne", "sabonete-carvao-ativado", "tonico-facial-antioxidante", "oe-melaleuca"],
        "why": "a argila verde absorve o excesso de oleosidade, o carvão desobstrui os poros e o creme com calêndula acalma a vermelhidão",
        "routine": [
            "Manhã: lave o rosto com o sabonete de argila verde (ou carvão ativado), enxágue bem e aplique o creme anti-oleosidade em pouca quantidade.",
            "Noite: repita a limpeza e use o tônico; no creme, menos é mais — pele oleosa também precisa de hidratação equilibrada.",
            "Não esprema as espinhas; isso pode deixar manchas e cicatrizes.",
        ],
        "tip": "Para espinha isolada, 1 gota de óleo essencial de melaleuca **sempre diluída** em óleo carreador, só à noite.",
        "doctor": "Acne com dor, nódulos ou cicatrizes merece avaliação de dermatologista.",
    },
    "oleosidade": {
        "label": "pele oleosa",
        "kw": ["oleosa", "oleosidade", "brilho no rosto", "brilhando", "poros dilatados", "poros abertos", "pele mista", "mista", "zona t"],
        "slugs": ["sabonete-argila-verde", "sabonete-carvao-ativado", "creme-oleosidade-acne", "tonico-facial-antioxidante"],
        "why": "a argila verde e o carvão ativado absorvem o excesso de sebo e limpam os poros sem ressecar",
        "routine": [
            "Lave o rosto 2x ao dia com o sabonete de argila verde (ou carvão para foco na zona T).",
            "Aplique o tônico facial e finalize com o creme de toque seco.",
            "Mesmo oleosa, a pele precisa de hidratação leve para não reagir com mais oleosidade (efeito rebote).",
        ],
        "tip": "Pele mista: carvão ativado na zona T (testa, nariz e queixo) e argila verde no restante.",
        "doctor": "",
    },
    "manchas": {
        "label": "manchas e clareamento",
        "kw": ["mancha", "manchas", "clarear", "clareamento", "clareador", "melasma", "escurecida", "escurecido", "escura", "escuro",
               "uniformizar", "hiperpigmentacao", "marca de acne", "marcas de acne", "axila escura", "virilha escura", "tom da pele", "cotovelo escuro"],
        "slugs": ["kit-clareamento", "sabonete-clareador-argila-branca", "oleo-rosa-mosqueta-20ml", "desodorante-clareador-solido", "refil-rosa-mosqueta", "sabonete-acafrao-dolomita"],
        "why": "a argila branca e a dolomita promovem clareamento progressivo e suave, e a rosa mosqueta ajuda na renovação da pele",
        "routine": [
            "Dia: sabonete clareador na pele úmida, deixando agir 3 minutos antes de enxaguar. **Protetor solar é indispensável** — sem ele as manchas voltam.",
            "Noite: 2 a 3 gotas do óleo de rosa mosqueta na pele limpa e seca (uso noturno; é fotossensível).",
            "Resultado é progressivo: costuma exigir constância de semanas.",
        ],
        "tip": "Para axilas, o desodorante clareador sólido ajuda a uniformizar o tom enquanto neutraliza odores.",
        "doctor": "Manchas que mudam rápido de cor, formato ou crescem devem ser avaliadas por um dermatologista.",
    },
    "pele_seca": {
        "label": "pele seca e ressecamento",
        "kw": ["pele seca", "ressecada", "ressecado", "ressecamento", "repuxando", "descamando", "descamacao", "pele aspera", "desidratada", "seca"],
        "slugs": ["sabonete-rosa-mosqueta-argila-rosa", "oleo-vegetal-de-jojoba", "oleo-abacate", "oleo-rosa-mosqueta-20ml", "manteiga-ojon"],
        "why": "a rosa mosqueta e a argila rosa limpam sem ressecar, e os óleos vegetais repõem a barreira de hidratação",
        "routine": [
            "Limpe com o sabonete de rosa mosqueta & argila rosa (água morna, nunca quente).",
            "Com a pele ainda levemente úmida, aplique 2 a 3 gotas de óleo vegetal (jojoba ou abacate).",
            "À noite, o óleo de rosa mosqueta potencializa a regeneração.",
        ],
        "tip": "Óleos vegetais ficam melhores aplicados com a pele um pouco úmida: selam a hidratação.",
        "doctor": "",
    },
    "pele_sensivel": {
        "label": "pele sensível",
        "kw": ["pele sensivel", "sensivel", "sensibilizada", "vermelhidao", "irritada", "irritacao", "ardendo", "ardencia", "rosacea", "reativa"],
        "slugs": ["sabonete-rosa-mosqueta-argila-rosa", "sabonete-liquido-barbatimao", "oleo-vegetal-centella-asiatica", "oleo-semente-uva"],
        "why": "fórmulas suaves, com argila rosa, barbatimão e centella ajudam a acalmar sem agredir",
        "routine": [
            "Use apenas 1 produto novo por vez e teste em uma área pequena (atrás da orelha ou no antebraço) por 24h.",
            "Lave com água morna e sabonete suave; evite esfoliar.",
            "Óleos essenciais NUNCA puros na pele sensível — sempre diluídos.",
        ],
        "tip": "Em peles muito reativas, vá devagar: um produto de cada vez.",
        "doctor": "Se a vermelhidão persistir ou vier com inchaço/ardência forte, procure um dermatologista.",
    },
    "anti_idade": {
        "label": "linhas de expressão e pele madura",
        "kw": ["ruga", "rugas", "linha de expressao", "linhas de expressao", "envelhecimento", "antienvelhecimento", "anti idade",
               "antiidade", "pele madura", "flacidez", "elasticidade", "antioxidante", "pe de galinha"],
        "slugs": ["oleo-rosa-mosqueta-20ml", "tonico-facial-antioxidante", "oleo-vegetal-centella-asiatica", "sabonete-rosa-mosqueta-argila-rosa"],
        "why": "rosa mosqueta e centella apoiam a regeneração e a elasticidade, e o tônico antioxidante protege a pele",
        "routine": [
            "Manhã: sabonete suave, tônico antioxidante e protetor solar.",
            "Noite: limpeza, tônico e 2 a 3 gotas de óleo de rosa mosqueta ou centella.",
        ],
        "tip": "Protetor solar todos os dias é o melhor anti-idade que existe.",
        "doctor": "",
    },
    "intimo": {
        "label": "higiene íntima",
        "kw": ["intimo", "intima", "higiene intima", "regiao intima", "vagina", "ph intimo", "corrimento", "coceira intima"],
        "slugs": ["sabonete-intimo-barbatimao", "sabonete-liquido-barbatimao"],
        "why": "o barbatimão tem ação antisséptica suave e a calêndula acalma, respeitando o equilíbrio da região",
        "routine": [
            "Use apenas na região **externa**, no banho: aplique, massageie suavemente e enxágue bem.",
            "Evite duchas internas.",
        ],
        "tip": "Serve para mulheres e homens, no dia a dia.",
        "doctor": "Corrimento diferente do habitual, odor forte, coceira persistente ou dor precisam de avaliação médica — sabonete não trata infecção.",
    },
    "pes": {
        "label": "pés rachados e ressecados",
        "kw": ["pe rachado", "pes rachados", "rachadura", "rachaduras", "calcanhar", "calcanhares", "pes", "pe de anjo", "pes de anjo", "calo"],
        "slugs": ["creme-pes-de-anjo", "oleo-vegetal-de-copaiba"],
        "why": "o creme tem barbatimão, aloe, copaíba e ureia, que amaciam e ajudam a recuperar a pele dos calcanhares",
        "routine": [
            "À noite, com os pés limpos e secos, aplique o creme massageando bem os calcanhares.",
            "Para potencializar, use meias de algodão.",
        ],
        "tip": "Os primeiros resultados aparecem em poucos dias de uso regular.",
        "doctor": "Rachaduras que sangram ou infeccionam merecem avaliação médica.",
    },
    "axila": {
        "label": "axilas, suor e desodorante",
        "kw": ["desodorante", "suor", "suvaco", "axila", "axilas", "cheiro de suor", "antitranspirante", "transpiracao", "aluminio"],
        "slugs": ["desodorante-clareador-solido", "sabonete-clareador-argila-branca"],
        "why": "é livre de alumínio, neutraliza o odor e ajuda a clarear, sem bloquear a transpiração saudável",
        "routine": [
            "Passe nas axilas limpas e secas.",
            "Na transição de antitranspirante para natural, o corpo pode levar 1 a 2 semanas para se ajustar.",
        ],
        "tip": "Combine com o sabonete clareador no banho para axilas mais uniformes.",
        "doctor": "",
    },
    "queda": {
        "label": "queda e crescimento capilar",
        "kw": ["queda de cabelo", "queda capilar", "cabelo caindo", "caindo", "cabelo cai", "cai muito", "queda", "caindo cabelo", "calvicie", "falhas no cabelo", "entradas", "crescer cabelo",
               "crescimento capilar", "crescimento do cabelo", "cabelo crescer", "afinando", "rarefeito", "tonico capilar", "couro cabeludo"],
        "slugs": ["tonico-capilar-anti-queda", "oleo-alecrim", "oleo-essencial-de-alecrim", "oleo-ricino"],
        "why": "alecrim e jaborandi estimulam a microcirculação do couro cabeludo, o que apoia o crescimento e fortalece os fios",
        "routine": [
            "Tônico: aplique no couro cabeludo limpo e massageie em movimentos circulares por 2 a 3 minutos.",
            "Umectação: óleo de alecrim nas raízes 30 minutos antes do banho, 2 a 3x por semana.",
            "Constância é o segredo: o ciclo capilar leva meses.",
        ],
        "tip": "Óleo essencial de alecrim só diluído em óleo vegetal; nunca puro no couro cabeludo.",
        "doctor": "Queda intensa ou repentina pode ter causa clínica (hormonal, nutricional) — vale consultar um médico.",
    },
    "cabelo_dano": {
        "label": "cabelos secos, ressecados e danificados",
        "kw": ["cabelo seco", "cabelos secos", "cabelo ressecado", "cabelo danificado", "pontas duplas", "frizz", "cabelo quebradico",
               "quebrando", "cabelo opaco", "hidratar cabelo", "hidratacao capilar", "cabelo"],
        "slugs": ["manteiga-ojon", "oleo-argan", "oleo-abacate", "oleo-ricino"],
        "why": "manteiga e óleos vegetais nutrem a fibra, selam as cutículas e reduzem o frizz",
        "routine": [
            "Nas pontas, depois de lavar e com o cabelo úmido, aplique 2 a 3 gotas de óleo de argan (ou um pouco da manteiga).",
            "Uma vez por semana, faça umectação: óleo nos fios por 30 minutos antes do shampoo.",
        ],
        "tip": "Menos é mais: excesso de óleo pesa no cabelo fino.",
        "doctor": "",
    },
    "cilios": {
        "label": "sobrancelhas e cílios",
        "kw": ["sobrancelha", "sobrancelhas", "cilios", "cilio", "falha na sobrancelha"],
        "slugs": ["oleo-ricino"],
        "why": "o óleo de rícino é rico em ácido ricinoleico e é muito usado para fortalecer e dar aparência de mais volume",
        "routine": ["Antes de dormir, aplique uma pequena quantidade com cotonete ou escovinha limpa, longe dos olhos."],
        "tip": "Evite contato com os olhos; se acontecer, lave com água corrente.",
        "doctor": "",
    },
    "couro_oleoso": {
        "label": "couro cabeludo oleoso",
        "kw": ["couro cabeludo oleoso", "raiz oleosa", "cabelo oleoso", "caspa", "coceira no couro", "seborreia"],
        "slugs": ["oe-menta", "tonico-capilar-anti-queda"],
        "why": "a menta piperita refresca e ajuda a equilibrar a oleosidade do couro cabeludo",
        "routine": ["Adicione 1 a 2 gotas de óleo essencial de menta a uma dose do seu shampoo (nunca puro no couro cabeludo)."],
        "tip": "Lave com água morna: água muito quente estimula mais oleosidade.",
        "doctor": "Descamação intensa, feridas ou coceira persistente: procure um dermatologista.",
    },
    "relaxar": {
        "label": "relaxamento e aromaterapia",
        "kw": ["relaxar", "relaxamento", "ansiedade", "ansioso", "estresse", "insonia", "dormir melhor", "calmante", "aromaterapia", "difusor", "aroma"],
        "slugs": ["oe-lavanda", "oe-laranja", "oe-menta"],
        "why": "a lavanda é a favorita da aromaterapia para acalmar; a laranja doce traz leveza e alegria",
        "routine": ["No difusor: 3 a 5 gotas de lavanda antes de dormir.", "Na pele, somente diluído em óleo vegetal."],
        "tip": "Óleos essenciais são concentrados: nunca ingerir e nunca aplicar puros.",
        "doctor": "Ansiedade e insônia persistentes pedem acompanhamento profissional — os óleos são apoio, não tratamento.",
    },
    "cicatriz": {
        "label": "cicatrizes e estrias",
        "kw": ["cicatriz", "cicatrizes", "estria", "estrias", "queloide", "marca de cicatriz"],
        "slugs": ["oleo-rosa-mosqueta-20ml", "oleo-vegetal-centella-asiatica", "oleo-vegetal-de-copaiba", "refil-rosa-mosqueta"],
        "why": "rosa mosqueta, centella e copaíba apoiam a regeneração da pele",
        "routine": ["Massageie o óleo na região todas as noites, com constância (estrias antigas respondem mais devagar)."],
        "tip": "Para cicatriz recente, só use depois que a ferida estiver totalmente fechada.",
        "doctor": "",
    },
    "dermatite": {
        "label": "coceira e dermatite",
        "kw": ["dermatite", "coceira", "coceira na pele", "eczema", "psoriase", "pele coçando", "pele coçando"],
        "slugs": ["oleo-semente-uva", "sabonete-liquido-barbatimao", "oleo-vegetal-centella-asiatica"],
        "why": "semente de uva, barbatimão e centella ajudam a acalmar e hidratar a pele irritada",
        "routine": ["Banho morno, sabonete suave e hidratação logo após o banho."],
        "tip": "Introduza 1 produto por vez.",
        "doctor": "Dermatite, eczema e psoríase precisam de diagnóstico médico; nossos produtos são apoio cosmético.",
    },
}

SKIN_TYPE_TO_CONCERN = {
    "oleosa": "oleosidade", "oleoso": "oleosidade", "mista": "oleosidade", "seca": "pele_seca", "seco": "pele_seca",
    "sensivel": "pele_sensivel", "madura": "anti_idade", "normal": "oleosidade",
}

# Palavras do domínio usadas para correção de digitação
EXTRA_VOCAB = (
    "foliculite acne espinha manchas melasma clareamento oleosidade hidratacao sabonete desodorante "
    "barbatimao calendula acafrao dolomita argila carvao mosqueta alecrim ricino jojoba argan abacate "
    "copaiba centella lavanda melaleuca menta laranja tonico manteiga ojon frete entrega prazo pagamento "
    "cartao parcelamento atacado revenda cupom desconto promocao rastreio pedido troca devolucao gravida "
    "gestante amamentando alergia vegano veganos natural artesanal ingredientes composicao rotina "
    "recomenda indica diferenca comparar estoque disponivel kit presente caspa estrias cicatriz dermatite"
).split()


# ───────────────────────────── resultado ─────────────────────────────
@dataclass
class LiaResult:
    reply: str
    product_ids: List[int] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    intent: str = "unknown"
    topic: str = "Dúvidas Gerais"
    confidence: float = 0.0


QuoteFn = Callable[[str, List[dict]], Tuple[List[dict], Optional[str]]]


# ───────────────────────────── motor ─────────────────────────────
class LiaEngine:
    def __init__(self, catalog: List[Item], quote_fn: Optional[QuoteFn] = None):
        self._GENERIC_STEMS = {stem(w) for w in self._GENERIC}
        self.items = [i for i in catalog]
        self.by_slug = {i.slug: i for i in self.items}
        self.quote_fn = quote_fn
        self._bm25 = BM25([[stem(w) for w in words(i.text_blob()) if w not in STOPWORDS] for i in self.items])
        vocab = set(EXTRA_VOCAB)
        for c in CONCERNS.values():
            for k in c["kw"]:
                vocab.update(words(k))
        for i in self.items:
            vocab.update(w for w in words(i.name) if len(w) >= 4)
        self._sig_df: Counter = Counter()
        for i in self.items:
            self._sig_df.update(set(stem(w) for w in words(i.name) if stem(w) not in self._GENERIC_STEMS and w not in STOPWORDS and len(w) > 2))
        self._vocab = sorted(w for w in vocab if len(w) >= 5)
        self._vocab_set = set(self._vocab)

    # ---------- normalização / correção ----------
    NO_CORRECT = {"comprar", "comprei", "compra", "comprando", "compras", "pedido", "pedidos", "pedir", "entrega", "entregar", "entregas",
                  "preciso", "precisa", "quando", "quanto", "quantos", "quantas", "outro", "outra", "outros", "depois", "antes", "tambem",
                  "melhor", "pessoa", "produto", "produtos", "cuidar", "cuidado", "cabelo", "cabelos", "rotina", "sabonetes", "usar", "passar"}

    def clean(self, text: str) -> str:
        out = []
        for w in norm(text).split():
            if len(w) >= 5 and w not in self.NO_CORRECT and w not in self._vocab_set and not w.isdigit() and not re.search(r"\d", w):
                m = difflib.get_close_matches(w, self._vocab, n=1, cutoff=0.82)
                if m:
                    w = m[0]
            out.append(w)
        return " ".join(out)

    @staticmethod
    def has(text: str, *phrases: str) -> bool:
        for p in phrases:
            if re.search(r"(?<![a-z0-9])" + re.escape(norm(p)) + r"(?![a-z0-9])", text):
                return True
        return False

    # ---------- entidades ----------
    def concerns_in(self, text: str) -> List[str]:
        scored = []
        for cid, c in CONCERNS.items():
            s = 0.0
            for k in c["kw"]:
                if self.has(text, k):
                    s += 1.0 + 0.4 * len(k.split())
            if s:
                scored.append((s, cid))
        scored.sort(reverse=True)
        # "cabelo" genérico perde para queixas capilares específicas
        ids = [cid for _, cid in scored]
        hair_words = self.has(text, "cabelo", "cabelos", "fios", "pontas", "couro cabeludo", "raiz", "shampoo")
        hair_ids = {"queda", "cabelo_dano", "cilios", "couro_oleo" + "so"}
        if hair_words:
            if "pele_seca" in ids and not (hair_ids & set(ids)):
                ids = ["cabelo_dano"] + [i for i in ids if i != "pele_seca"]
            else:
                ids = [i for i in ids if i not in ("pele_seca", "oleosidade", "manchas")] or ids
        if "oleosidade" in ids and "pele_seca" in ids:
            ids = ["oleosidade", "pele_seca"] + [i for i in ids if i not in ("oleosidade", "pele_seca")]
        if "cabelo_dano" in ids and any(x in ids for x in ("queda", "couro_oleoso", "cilios")):
            ids.remove("cabelo_dano")
        return ids[:2]

    def skin_type_in(self, text: str) -> Optional[str]:
        for w in words(text):
            if w in SKIN_TYPE_TO_CONCERN and w != "normal":
                return SKIN_TYPE_TO_CONCERN[w]
        return None

    _NOT_DISTINCTIVE = {"cabelo", "corpo", "facial", "pele", "natural", "anti", "queda", "capilar", "clareador", "clareamento",
                        "antioxidante", "oleosidade", "acne", "rachaduras", "potente", "solido", "liquido", "tonico", "manteiga"}
    _GENERIC = {"sabonete", "oleo", "essencial", "vegetal", "puro", "100", "kit", "creme", "ml", "refil", "de", "e", "da", "do", "para", "com", "em", "3", "1", "20", "60"}

    def products_in(self, text: str, exact_only: bool = False) -> List[Item]:
        """Casamento difuso de produtos citados no texto."""
        tw = [stem(w) for w in words(text)]
        tws = set(tw)
        scored: List[Tuple[float, Item]] = []
        for it in self.items:
            if norm(it.name) in text:
                scored.append((2.0, it))
                continue
            if exact_only:
                continue
            sig = list(dict.fromkeys(stem(w) for w in words(it.name) if stem(w) not in self._GENERIC_STEMS and w not in STOPWORDS and len(w) > 2))
            if not sig:
                continue
            hit = [w for w in sig if w in tws]
            if not hit:
                continue
            frac = len(hit) / len(sig)
            gen = [stem(w) for w in words(it.name) if stem(w) in self._GENERIC_STEMS and len(w) >= 3]
            bonus = 0.25 if any(g in tws for g in gen) else 0.0
            unique = any(self._sig_df[w] == 1 and len(w) >= 5 and w not in self._NOT_DISTINCTIVE for w in hit)
            if frac + bonus >= 0.75 or (len(sig) == 1 and frac == 1) or (len(hit) >= 2 and frac >= 0.6):
                scored.append((frac + bonus, it))
            elif unique:
                scored.append((1.0, it))
        if not scored:
            return []
        scored.sort(key=lambda x: -x[0])
        top = scored[0][0]
        return [it for s, it in scored if s >= top - 0.01 or s >= 1.0][:4]

    def search(self, text: str, limit: int = 3, min_score: float = 2.0) -> List[Item]:
        q = [stem(w) for w in words(text) if w not in STOPWORDS and len(w) > 2]
        if not q:
            return []
        ranked = [(i, s) for i, s in self._bm25.rank(q) if s >= min_score]
        return [self.items[i] for i, _ in ranked[:limit]]

    def pick_for(self, concern_ids: List[str], skin_tags: Optional[List[str]] = None, limit: int = 3) -> List[Item]:
        scores: Dict[int, float] = {}
        for rank_c, cid in enumerate(concern_ids):
            for pos, slug in enumerate(CONCERNS[cid]["slugs"]):
                it = self.by_slug.get(slug)
                if it and it.available:
                    scores[it.id] = scores.get(it.id, 0) + (10 - pos) * (1.0 if rank_c == 0 else 0.7)
        for it in self.items:
            for t in skin_tags or []:
                if t in [x.lower() for x in it.tags] and it.id in scores:
                    scores[it.id] += 2
        ranked = sorted(scores.items(), key=lambda x: -x[1])
        by_id = {i.id: i for i in self.items}
        return [by_id[i] for i, _ in ranked[:limit]]

    # ---------- formatação ----------
    def price_line(self, it: Item) -> str:
        if it.on_sale and it.sale_price and it.sale_price < it.price:
            off = round((1 - it.sale_price / it.price) * 100)
            return f"de {fmt_brl(it.price)} por **{fmt_brl(it.sale_price)}** ({off}% OFF)"
        return f"**{fmt_brl(it.eff_price)}**"

    def card(self, it: Item) -> str:
        why = (it.benefits or it.description or "").strip().rstrip(".")
        why = (" — " + why[0].lower() + why[1:]) if why else ""
        return f"• **{it.name}** ({self.price_line(it)}){why}"

    @staticmethod
    def pick_variant(seed: str, options: Sequence[str]) -> str:
        h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
        return options[h % len(options)]

    def free_ship_text(self) -> str:
        return (f"**Frete grátis**: Sul/Sudeste a partir de {fmt_brl(FREE_SHIPPING_SOUTH_SOUTHEAST)} e demais regiões a partir de "
                f"{fmt_brl(FREE_SHIPPING_OTHER_REGIONS)} — o sistema aplica a opção mais barata automaticamente.")

    # ---------- contexto da conversa ----------
    def context_from_history(self, history: Sequence[dict]) -> dict:
        ctx = {"concerns": [], "products": [], "asked_skin": False, "last_intent": None}
        for m in list(history)[-8:]:
            content = m.get("content") or ""
            role = m.get("role")
            t = self.clean(content)
            if role == "user":
                for c in self.concerns_in(t):
                    if c not in ctx["concerns"]:
                        ctx["concerns"].insert(0, c)
                st = self.skin_type_in(t)
                if st and st not in ctx["concerns"]:
                    ctx["concerns"].insert(0, st)
                prods = self.products_in(t)
                if prods:
                    ctx["products"] = prods
            else:
                low = norm(content)
                prods = self.products_in(low, exact_only=True)
                if prods:
                    # na ordem em que aparecem na resposta: o 1º é o principal
                    prods.sort(key=lambda it: low.find(norm(it.name)))
                    ctx["products"] = prods
                if "tipo de pele" in norm(content) or "como e a sua pele" in norm(content):
                    ctx["asked_skin"] = True
                else:
                    ctx["asked_skin"] = False
        return ctx

    # ---------- intenção ----------
    def intent_of(self, t: str, has_products: bool, concerns: List[str]) -> str:
        h = lambda *p: self.has(t, *p)  # noqa: E731
        if re.search(r"\b\d{5}-?\d{3}\b", t) or h("entregam", "enviam", "envio para", "entrega no", "entrega para", "envia para", "chega no", "chegar em", "chegar no", "chega em", "frete", "prazo de entrega", "quanto tempo demora", "demora para chegar", "entregam", "entrega em", "calcular frete"):
            if h("gratis", "gratuito") and not re.search(r"\b\d{5}-?\d{3}\b", t):
                return "free_shipping"
            return "shipping"
        if h("frete gratis", "entrega gratis", "frete gratuito"):
            return "free_shipping"
        if h("rastrear", "rastreio", "codigo de rastreio", "meu pedido", "status do pedido", "onde esta meu pedido", "acompanhar pedido", "pedido atrasado", "nao chegou"):
            return "order_status"
        if h("trocar", "troca", "devolver", "devolucao", "reembolso", "estorno", "cancelar", "cancelamento", "arrependi"):
            return "returns"
        if h("pagamento", "pagar", "pix", "cartao", "parcelar", "parcela", "parcelamento", "boleto", "combinado", "forma de pagamento", "formas de pagamento"):
            return "payment"
        if h("cupom", "codigo de desconto", "primeira compra", "primeiracompra", "voucher"):
            return "coupon"
        if h("atacado", "revenda", "revender", "revendedor", "para revender", "comprar em quantidade", "quero revender"):
            return "wholesale"
        if h("promocao", "promocoes", "oferta", "ofertas", "desconto", "descontos", "mais barato", "barato", "em promocao", "black friday", "liquidacao"):
            return "promo"
        if h("mais vendido", "mais vendidos", "queridinho", "queridinhos", "mais procurado", "campeao de vendas", "best seller"):
            return "bestseller"
        if h("humano", "atendente", "falar com alguem", "falar com uma pessoa", "whatsapp", "suporte", "contato", "telefone"):
            return "human"
        if h("grávida", "gravida", "gestante", "gravidez", "amamentando", "amamentacao", "lactante", "bebe", "crianca", "filho", "alergia", "alergico", "alergica", "remedio", "medicamento", "tratamento medico", "cancer", "quimioterapia"):
            return "safety"
        if h("vegano", "veganos", "vegana", "cruelty", "testado em animais", "testam em animais", "animal", "parabeno", "sulfato", "silicone", "petroleo", "quimica", "natural mesmo", "100 natural", "organico"):
            return "brand_values"
        if h("quem e voce", "quem e a lia", "voce e uma ia", "voce e robo", "voce e humana", "o que voce faz", "como voce pode ajudar", "o que voce sabe"):
            return "about_lia"
        if h("diferenca entre", "diferenca de", "qual a diferenca", "comparar", "qual melhor", "qual e melhor", "x ou", " vs "):
            return "compare" if has_products else "recommend"
        if re.search(r"\b\d+\s*(un|unid|unidades?|x)?\s*(de\s+)?[a-z]{4,}", t) and h("quanto fica", "quanto custa", "quanto sai", "total", "valor de", "quanto ficam", "quanto fica"):
            return "calc"
        if has_products and re.search(r"\b\d{1,3}\s*(un|unid|unidades?|x)?\s*(de\s+)?(sabonete|oleo|kit|creme|desodorante|tonico|manteiga|produto)", t) and h("comprar", "quero", "levar", "pedir", "fica", "custa", "total", "preciso", "vou querer", "sai"):
            return "calc"
        if re.search(r"\b(posso|pode|podem)\s+(usar|passar|aplicar)\b", t) and not h("direto na pele", "puro na pele"):
            return "how_to_use"
        if re.search(r"\b(tem|contem|leva|possui|usa|e livre de|livre de)\s+(algum\s+|alguma\s+)?[a-z]{4,}", t) and has_products and not h("tem estoque", "tem frete", "tem kit", "tem cupom", "tem desconto", "tem promocao"):
            return "ingredient_check"
        if re.search(r"\bcomo (eu )?(uso|usar|usa|aplico|aplicar|passo|passar|utilizo|utilizar)\b", t) or h("como usar", "como uso", "como usa", "como aplicar", "modo de uso", "como passar", "como utilizar", "posso usar", "usar todo dia", "todo dia", "quantas vezes", "quantas gotas", "deixar agir", "quando usar"):
            return "how_to_use"
        if h("ingrediente", "ingredientes", "composicao", "tem o que", "feito de", "ativos", "formula", "contem", "tem alguma coisa", "leva o que"):
            return "ingredients"
        if h("direto na pele", "puro na pele", "pode passar", "posso passar", "pode aplicar", "posso aplicar", "pode passar puro", "diluir", "diluicao", "contraindicacao", "contraindicado", "efeito colateral", "irrita", "faz mal", "seguro", "pode usar no rosto", "posso usar no rosto", "uso externo", "pode usar no corpo"):
            return "safety_product"
        if h("preco", "quanto custa", "quanto e", "quanto sai", "valor", "custa quanto", "quanto esta", "qual o valor"):
            return "price"
        if h("tem estoque", "disponivel", "disponibilidade", "esgotado", "tem no estoque", "ainda tem", "tem para pronta entrega"):
            return "stock"
        if h("rotina", "passo a passo", "ordem de uso", "skincare", "cronograma"):
            return "routine"
        if h("presente", "presentear", "kit para presente", "caixa de presente"):
            return "gift"
        if h("como comprar", "como faco para comprar", "como faco o pedido", "como fazer o pedido", "como finalizar", "como faco a compra", "como compro") or (h("quero comprar", "quero fazer um pedido", "fazer pedido") and not has_products):
            return "how_to_buy"
        if h("catalogo", "o que voces vendem", "quais produtos", "que produtos", "lista de produtos", "todos os produtos", "linha de produtos"):
            return "catalog"
        if concerns:
            return "recommend"
        if h("indica", "indicar", "recomenda", "recomendar", "sugere", "sugestao", "qual produto", "o que usar", "o que passar", "o que posso usar", "me ajuda", "preciso de", "procuro", "quero algo", "melhor produto"):
            return "recommend"
        if has_products:
            return "product_info"
        if h("obrigad", "valeu", "agradeco", "muito bom", "perfeito", "otimo", "show", "legal", "gostei"):
            return "thanks"
        if h("tchau", "ate mais", "ate logo", "flw", "falou", "ate a proxima"):
            return "bye"
        if re.fullmatch(r"(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|eae|hey|hello|oie|ola lia|oi lia)( lia)?[!. ]*", t):
            return "greeting"
        if h("oi", "ola", "bom dia", "boa tarde", "boa noite") and len(t.split()) <= 4:
            return "greeting"
        return "unknown"

    # ---------- respostas ----------
    def answer(self, message: str, history: Optional[Sequence[dict]] = None) -> LiaResult:
        history = list(history or [])
        t = self.clean(message)
        ctx = self.context_from_history(history)
        concerns = self.concerns_in(t)
        skin_concern = self.skin_type_in(t)
        # "oleosa" sozinho, respondendo à pergunta de diagnóstico
        if skin_concern and (ctx["asked_skin"] or len(t.split()) <= 4) and skin_concern not in concerns:
            concerns = [skin_concern] + concerns
        prods = self.products_in(t)
        ctx_concerns = ctx["concerns"][:1] if not concerns else []
        follow_up = (not prods and not concerns and bool(ctx["products"]))
        intent = self.intent_of(t, bool(prods) or follow_up, concerns)

        # saudações e cortesia
        if intent == "greeting":
            return self._greeting(message)
        if intent == "thanks":
            return LiaResult(self.pick_variant(message, [
                "Imagina, foi um prazer! 🌿 Se surgir outra dúvida sobre pele, cabelo ou pedido, é só chamar.",
                "Por nada! Fico feliz em ajudar. 💚 Quer que eu monte uma rotina completa para você?",
            ]), intent=intent, topic="Dúvidas Gerais", confidence=0.9,
                suggestions=["Montar uma rotina", "Ver promoções"])
        if intent == "bye":
            return LiaResult("Até mais! 🌿 Quando quiser, é só voltar aqui.", intent=intent, confidence=0.9)

        handler = {
            "shipping": self._shipping, "free_shipping": self._free_shipping, "order_status": self._order_status,
            "returns": self._returns, "payment": self._payment, "coupon": self._coupon, "wholesale": self._wholesale,
            "promo": self._promo, "human": self._human, "safety": self._safety, "brand_values": self._brand,
            "about_lia": self._about, "how_to_buy": self._how_to_buy, "catalog": self._catalog, "gift": self._gift, "bestseller": self._bestseller,
        }.get(intent)
        if handler:
            return handler(message, t, prods or ctx["products"], concerns)

        if intent == "compare":
            return self._compare(t, prods)
        if intent == "calc":
            return self._calc(t, prods)
        if intent == "recommend" and prods and not self.has(t, "indica", "indicar", "recomenda", "recomendar", "sugere", "qual produto", "o que usar", "preciso de", "procuro"):
            intent = "product_info"
        if intent in {"how_to_use", "ingredients", "ingredient_check", "safety_product", "price", "stock", "product_info"}:
            target = prods or ctx["products"]
            others: List[Item] = []
            if not prods and len(target) > 1 and intent != "price":
                others, target = target[1:], target[:1]
            if not target and concerns:
                return self._recommend(message, t, concerns, ctx)
            if not target:
                return self._ask_which_product(intent)
            res = self._product_detail(intent, target, t)
            if others:
                res.reply += "\n\nSe quiser o mesmo detalhe de " + " ou ".join(f"**{o.name}**" for o in others[:2]) + ", é só pedir. 🌿"
                res.suggestions = [f"{ {'how_to_use': 'Como usar', 'ingredients': 'Ingredientes de', 'stock': 'Tem estoque de', 'safety_product': 'É seguro usar'}.get(intent, 'Fale sobre') } {o.name}" for o in others[:2]] or res.suggestions
            if concerns and intent in {"product_info", "how_to_use"}:
                doc = CONCERNS[concerns[0]].get("doctor")
                if doc:
                    res.reply += f"\n\n⚠️ {doc}"
            return res
        if intent == "routine":
            return self._routine(t, concerns or ctx["concerns"][:2], ctx)
        if intent == "recommend":
            if not concerns and ctx_concerns and self.has(t, "e para", "e se", "tambem", "outro", "outra", "mais"):
                concerns = ctx_concerns
            return self._recommend(message, t, concerns, ctx)

        # desconhecido → tenta recuperação BM25 no catálogo
        found = self.search(t, limit=3, min_score=3.0)
        if found:
            lines = [self.card(i) for i in found]
            return LiaResult(
                "Encontrei estes produtos que combinam com o que você procura: 🌿\n\n" + "\n".join(lines)
                + "\n\nQuer que eu detalhe o modo de uso de algum deles?",
                product_ids=[i.id for i in found], intent="search", topic=self._topic_for(None, found), confidence=0.55,
                suggestions=[f"Como usar {found[0].name}?", "Montar uma rotina"],
            )
        return self._clarify()

    # ----- handlers -----
    def _greeting(self, message: str) -> LiaResult:
        return LiaResult(self.pick_variant(message, [
            "Oi! Eu sou a **Lia**, consultora de beleza natural da Ecosopis. 🌿 Me conta: o que você quer cuidar hoje — pele, cabelo ou algo específico?",
            "Olá! Que bom ter você aqui. 💚 Sou a Lia e posso indicar produtos, montar uma rotina, calcular frete ou tirar dúvidas. Por onde começamos?",
        ]), intent="greeting", confidence=0.95,
            suggestions=["Tenho foliculite", "Pele oleosa e acne", "Manchas na pele", "Calcular frete"])

    def _clarify(self) -> LiaResult:
        return LiaResult(
            "Quero te ajudar direitinho, mas não entendi bem o que você procura. 🌿 Você pode me dizer, por exemplo:\n\n"
            "• o que quer tratar (foliculite, acne, manchas, pele seca, queda de cabelo...);\n"
            "• o nome de um produto para eu detalhar uso, ingredientes e preço;\n"
            "• seu CEP, para eu calcular o frete.",
            intent="unknown", confidence=0.1,
            suggestions=["Pele oleosa e acne", "Queda de cabelo", "Ver promoções", "Calcular frete"],
        )

    def _ask_which_product(self, intent: str) -> LiaResult:
        return LiaResult(
            "Sobre qual produto você quer saber? Pode me dizer o nome (por exemplo, *Sabonete de Argila Verde*) "
            "ou me contar o que quer tratar que eu indico o ideal. 🌿",
            intent=intent, confidence=0.4,
            suggestions=["Sabonete de Açafrão e Dolomita", "Óleo de Rosa Mosqueta", "Pele oleosa e acne"],
        )

    def _topic_for(self, concerns: Optional[List[str]], prods: Optional[List[Item]] = None) -> str:
        c = (concerns or [None])[0]
        return {
            "foliculite": "Clareamento & Foliculite", "manchas": "Clareamento & Foliculite", "axila": "Clareamento & Foliculite",
            "acne": "Acne & Oleosidade", "oleosidade": "Acne & Oleosidade", "pele_seca": "Hidratação & Pele Seca",
            "pele_sensivel": "Hidratação & Pele Seca", "anti_idade": "Hidratação & Pele Seca", "pes": "Hidratação & Pele Seca",
            "queda": "Óleos & Cuidados Capilares", "cabelo_dano": "Óleos & Cuidados Capilares", "cilios": "Óleos & Cuidados Capilares",
            "couro_oleoso": "Óleos & Cuidados Capilares", "relaxar": "Óleos & Cuidados Capilares", "intimo": "Higiene Natural & Sabonetes",
        }.get(c or "", "Dúvidas Gerais")

    def _recommend(self, message: str, t: str, concerns: List[str], ctx: dict) -> LiaResult:
        if not concerns:
            # pedido genérico → pergunta de diagnóstico (uma só)
            found = self.search(t, limit=3, min_score=3.5)
            if found:
                return LiaResult(
                    "Estas opções combinam com o que você pediu: 🌿\n\n" + "\n".join(self.card(i) for i in found),
                    product_ids=[i.id for i in found], intent="recommend", confidence=0.6,
                    suggestions=[f"Como usar {found[0].name}?"])
            return LiaResult(
                "Para eu indicar o ideal, me conta: **qual é o seu principal objetivo?** 🌿\n\n"
                "• Pele: acne e oleosidade, manchas, ressecamento, foliculite, sensibilidade\n"
                "• Cabelo: queda, ressecamento, couro cabeludo oleoso\n"
                "• Outros: pés rachados, axilas, higiene íntima, aromaterapia\n\n"
                "Se for pele do rosto, diga também se ela é **oleosa, seca, mista ou sensível**.",
                intent="recommend", confidence=0.5,
                suggestions=["Pele oleosa", "Pele seca", "Manchas", "Queda de cabelo"])
        main = concerns[0]
        c = CONCERNS[main]
        skin_tags = []
        if "oleosidade" in concerns or main == "acne":
            skin_tags = ["skin:oily"]
        elif "pele_seca" in concerns:
            skin_tags = ["skin:dry"]
        prods = self.pick_for(concerns, skin_tags, limit=3)
        if not prods:
            return self._clarify()
        intro = self.pick_variant(message, [
            f"Para **{c['label']}**, eu indico: 🌿",
            f"Entendi — sobre **{c['label']}**, o que mais combina é: 🌿",
            f"Boa pergunta! Para **{c['label']}**, minha sugestão é: 🌿",
        ])
        body = "\n".join(self.card(i) for i in prods)
        parts = [intro, "", body, "", f"**Por quê?** Porque {c['why']}."]
        if c["routine"]:
            parts += ["", "**Como usar:**"] + [f"{n}. {s}" for n, s in enumerate(c["routine"][:3], 1)]
        if c.get("tip"):
            parts += ["", f"💡 {c['tip']}"]
        if c.get("doctor"):
            parts += ["", f"⚠️ {c['doctor']}"]
        if main in {"pele_seca", "pele_sensivel", "anti_idade", "oleosidade", "acne"} and not ctx.get("asked_skin"):
            pass
        if len(concerns) > 1:
            parts += ["", f"Você também mencionou **{CONCERNS[concerns[1]]['label']}** — posso montar uma rotina que cubra os dois."]
        return LiaResult(
            "\n".join(parts), product_ids=[i.id for i in prods], intent="recommend",
            topic=self._topic_for(concerns), confidence=0.9,
            suggestions=[f"Como usar {prods[0].name}?", "Montar uma rotina", "Calcular frete"],
        )

    def _routine(self, t: str, concerns: List[str], ctx: dict) -> LiaResult:
        if not concerns:
            return LiaResult(
                "Claro! Para montar uma rotina sob medida preciso de 2 informações: **o que você quer tratar** (acne, manchas, "
                "ressecamento, foliculite, queda de cabelo...) e, se for rosto, o **tipo de pele** (oleosa, seca, mista ou sensível). "
                "Pode me contar? 🌿",
                intent="routine", confidence=0.5, suggestions=["Pele oleosa com acne", "Manchas", "Pele seca"])
        main = concerns[0]
        c = CONCERNS[main]
        prods = self.pick_for(concerns, limit=3)
        steps = "\n".join(f"{n}. {s}" for n, s in enumerate(c["routine"], 1))
        text = (f"Rotina para **{c['label']}**: 🌿\n\n{steps}\n\n**Produtos da rotina:**\n"
                + "\n".join(self.card(i) for i in prods))
        if c.get("doctor"):
            text += f"\n\n⚠️ {c['doctor']}"
        return LiaResult(text, product_ids=[i.id for i in prods], intent="routine", topic=self._topic_for(concerns),
                         confidence=0.85, suggestions=["Calcular frete", f"Como usar {prods[0].name}?" if prods else "Ver promoções"])

    def _product_detail(self, intent: str, prods: List[Item], t: str) -> LiaResult:
        if len(prods) > 1 and intent != "price":
            names = "\n".join(f"• **{p.name}**" for p in prods)
            return LiaResult(
                f"Encontrei mais de um produto com esse nome — qual deles você quer dizer? 🌿\n\n{names}",
                product_ids=[p.id for p in prods], intent=intent, confidence=0.5,
                suggestions=[p.name for p in prods[:3]])
        p = prods[0]
        pid = [p.id]
        if intent == "price":
            lines = [f"• **{x.name}**: {self.price_line(x)}" for x in prods[:4]]
            extra = ""
            if any(x.is_wholesale for x in prods):
                extra = (f"\n\nNo **atacado**, a partir de {WHOLESALE_MIN_UNITS} unidades dos produtos de atacado você ganha 45% de desconto automático.")
            return LiaResult("Os valores atuais: 💚\n\n" + "\n".join(lines) + extra, product_ids=[x.id for x in prods[:4]],
                             intent=intent, topic=self._topic_for(None), confidence=0.9,
                             suggestions=["Calcular frete", "Ver promoções"])
        if intent == "stock":
            if p.available:
                return LiaResult(f"Sim! O **{p.name}** está disponível agora ({self.price_line(p)}). Você pode adicionar ao carrinho direto aqui na Lia. 🛒",
                                 product_ids=pid, intent=intent, confidence=0.9, suggestions=["Calcular frete"])
            return LiaResult(f"O **{p.name}** está esgotado no momento. Posso te sugerir uma alternativa parecida? 🌿",
                             product_ids=pid, intent=intent, confidence=0.9, suggestions=["Sim, sugira outro"])
        if intent == "how_to_use":
            use = (p.modo_de_uso or "").strip()
            if not use:
                use = "Siga a orientação da embalagem e, em caso de dúvida, nossa equipe te orienta."
            extra = []
            if p.cuidados:
                extra.append(f"**Cuidados:** {p.cuidados.strip()}")
            nm = norm(p.name)
            if "oleo vegetal" in nm or "oleo de" in nm or "rosa mosqueta" in nm:
                extra.append("Óleos vegetais são fotossensíveis: use **à noite** e passe protetor solar pela manhã.")
            if "essencial" in nm or p.slug.startswith("oe-"):
                extra.append("Óleo essencial é concentrado: **nunca puro na pele** — dilua em óleo carreador ou use no difusor.")
            txt = f"Como usar o **{p.name}**: 🌿\n\n{use}" + ("\n\n" + "\n".join(extra) if extra else "")
            return LiaResult(txt, product_ids=pid, intent=intent, confidence=0.92,
                             suggestions=["Ver ingredientes", "Quanto custa?", "Calcular frete"])
        if intent == "ingredients":
            ing = (p.ingredients or "").strip()
            txt = f"Ingredientes do **{p.name}**: 🌿\n\n{ing or 'Informação detalhada na página do produto.'}"
            if p.benefits:
                txt += f"\n\n**Benefícios:** {p.benefits.strip()}"
            if p.observacoes:
                txt += f"\n\n{p.observacoes.strip()}"
            return LiaResult(txt, product_ids=pid, intent=intent, confidence=0.92, suggestions=["Como usar?", "Quanto custa?"])
        if intent == "ingredient_check":
            return self._ingredient_check(p, t)
        if intent == "safety_product":
            txt = f"Sobre a segurança do **{p.name}**: 🌿\n\n"
            if "essencial" in norm(p.name) or p.slug.startswith("oe-"):
                txt += ("**Não aplique puro na pele.** Óleos essenciais são muito concentrados e podem irritar ou sensibilizar. "
                        "Dilua 1 a 2 gotas em um óleo carreador (como semente de uva) ou use no difusor.\n\n")
            txt += (p.contraindicacoes.strip() + "\n\n") if p.contraindicacoes else ""
            txt += "Faça sempre um **teste em uma área pequena** (atrás da orelha ou antebraço) e aguarde 24h antes do primeiro uso."
            if p.observacoes:
                txt += f"\n\n{p.observacoes.strip()}"
            return LiaResult(txt, product_ids=pid, intent=intent, confidence=0.9)
        # product_info: ficha resumida
        parts = [f"**{p.name}** — {self.price_line(p)} 🌿"]
        if p.description:
            parts.append(p.description.strip())
        if p.benefits:
            parts.append(f"**Benefícios:** {p.benefits.strip()}")
        if p.ingredients:
            parts.append(f"**Ativos:** {p.ingredients.strip()}")
        if p.modo_de_uso:
            parts.append(f"**Como usar:** {p.modo_de_uso.strip()}")
        return LiaResult("\n\n".join(parts), product_ids=pid, intent="product_info", confidence=0.9,
                         suggestions=["Quanto custa?", "Calcular frete", "Montar uma rotina"])

    BRAND_FREE_FROM = {"parabeno": "parabenos", "sulfato": "sulfatos agressivos", "silicone": "silicones", "petroleo": "derivados de petróleo"}

    def _ingredient_check(self, p: Item, t: str) -> LiaResult:
        m = re.search(r"\b(?:tem|contem|leva|possui|usa|livre de)\s+(?:algum\s+|alguma\s+|o\s+|a\s+)?([a-z]{4,})", t)
        term = m.group(1) if m else ""
        stem_term = stem(term)
        for k, label in self.BRAND_FREE_FROM.items():
            if k in t:
                return LiaResult(f"Não! Os produtos Ecosopis são livres de {label}. 🌱 Você confere a lista completa na página do **{p.name}**.",
                                 product_ids=[p.id], intent="ingredient_check", confidence=0.85)
        if "aluminio" in t and p.slug == "desodorante-clareador-solido":
            return LiaResult("O **Desodorante Clareador Sólido** é **livre de alumínio** (e de bicarbonato abrasivo): usa argila branca, hidróxido de magnésio e manteiga de karité. 🌿",
                             product_ids=[p.id], intent="ingredient_check", confidence=0.9, suggestions=["Como usar?", "Quanto custa?"])
        blob = norm(" ".join([p.ingredients, p.description, p.benefits, p.name]))
        if term and (term in blob or stem_term in blob):
            return LiaResult(f"Sim, o **{p.name}** contém **{term}**. Ingredientes: {p.ingredients or 'veja na página do produto'}. 🌿",
                             product_ids=[p.id], intent="ingredient_check", confidence=0.85, suggestions=["Como usar?"])
        return LiaResult(f"**{term.capitalize() if term else 'Esse item'}** não consta na lista de ingredientes do **{p.name}**: {p.ingredients or 'veja na página do produto'}. "
                         "Se você tem alergia, posso te mostrar a composição completa. 🌿",
                         product_ids=[p.id], intent="ingredient_check", confidence=0.7, suggestions=["Ver composição"])

    def _bestseller(self, message, t, prods, concerns) -> LiaResult:
        picks = [self.by_slug.get(s) for s in ("sabonete-acafrao-dolomita", "kit-clareamento", "sabonete-argila-verde")]
        picks = [i for i in picks if i]
        return LiaResult(
            "Os queridinhos das clientes: 💚\n\n" + "\n".join(self.card(i) for i in picks)
            + "\n\nO **Sabonete de Açafrão e Dolomita** é o nosso campeão para foliculite e o **Kit Clareamento** é o mais procurado para manchas.",
            product_ids=[i.id for i in picks], intent="bestseller", confidence=0.8, suggestions=["Ver promoções", "Montar uma rotina"])

    def _compare(self, t: str, prods: List[Item]) -> LiaResult:
        if len(prods) < 2:
            return LiaResult("Para comparar, me diga os dois produtos (ex.: *argila verde e carvão ativado*). 🌿",
                             intent="compare", confidence=0.4)
        a, b = prods[0], prods[1]

        def line(x: Item) -> str:
            return (f"**{x.name}** ({self.price_line(x)})\n"
                    f"• Indicado para: {x.benefits or x.description or '—'}\n"
                    f"• Ativos: {x.ingredients or '—'}")
        return LiaResult(f"Comparando: 🌿\n\n{line(a)}\n\n{line(b)}\n\nSe você me contar seu tipo de pele ou objetivo, eu digo qual combina mais com você.",
                         product_ids=[a.id, b.id], intent="compare", confidence=0.85, suggestions=["Minha pele é oleosa", "Minha pele é seca"])

    def _calc(self, t: str, prods: List[Item]) -> LiaResult:
        m = re.search(r"\b(\d+)\b", t)
        qty = int(m.group(1)) if m else 1
        if not prods:
            return self._ask_which_product("calc")
        p = prods[0]
        unit = p.eff_price
        wholesale = qty >= WHOLESALE_MIN_UNITS and p.is_wholesale
        if wholesale:
            unit = round(p.price * WHOLESALE_FACTOR, 2)
        total = round(unit * qty, 2)
        txt = f"{qty} × **{p.name}** = **{fmt_brl(total)}** ({fmt_brl(unit)} cada)."
        if wholesale:
            txt += " Já com o **desconto de atacado de 45%** (a partir de 10 unidades). 🎉"
        elif p.is_wholesale and qty < WHOLESALE_MIN_UNITS:
            txt += f" Com {WHOLESALE_MIN_UNITS}+ unidades dos produtos de atacado, o preço cai 45%."
        gap = FREE_SHIPPING_SOUTH_SOUTHEAST - total
        txt += (f"\n\nPara **frete grátis** no Sul/Sudeste faltam {fmt_brl(gap)}." if gap > 0 else "\n\nIsso já garante **frete grátis** no Sul/Sudeste! 🚚")
        return LiaResult(txt, product_ids=[p.id], intent="calc", confidence=0.85, suggestions=["Calcular frete", "Pagamento"])

    def _shipping(self, message: str, t: str, prods, concerns) -> LiaResult:
        m = re.search(r"\b(\d{5})-?(\d{3})\b", t)
        if not m:
            return LiaResult(
                "Posso calcular agora! Me envie o seu **CEP** (ex.: 01310-100). 🚚\n\n" + self.free_ship_text()
                + "\n\nNo carrinho você também vê todas as opções, da mais barata para a mais cara.",
                intent="shipping", topic="Frete & Envio", confidence=0.8, suggestions=["Pagamento", "Ver promoções"])
        cep = m.group(1) + m.group(2)
        item = prods[0] if prods else None
        chosen = list(prods[:3]) if prods else []
        sample = [{
            "id": str(x.id), "name": x.name, "width": 16, "height": 12, "length": 20, "weight": 0.1, "price": x.eff_price, "quantity": 1,
        } for x in chosen] or [{"id": "1", "name": "Sabonete", "width": 16, "height": 12, "length": 20, "weight": 0.1, "price": 15.0, "quantity": 1}]
        options, err = ([], "sem cotação")
        if self.quote_fn:
            try:
                options, err = self.quote_fn(cep, sample)
            except Exception as e:  # noqa: BLE001
                options, err = [], str(e)
        thr = FREE_SHIPPING_SOUTH_SOUTHEAST if (1 <= int(cep[:2]) <= 39 or 80 <= int(cep[:2]) <= 99) else FREE_SHIPPING_OTHER_REGIONS
        if not options:
            bad = err and ("inválid" in err.lower() or "nenhuma" in err.lower())
            if bad:
                return LiaResult("Não consegui encontrar esse CEP. Confira os 8 dígitos e me envie de novo, por favor. 🙏",
                                 intent="shipping", topic="Frete & Envio", confidence=0.7)
            return LiaResult(
                f"Não consegui consultar as transportadoras agora. Você vê o valor exato colocando o CEP no carrinho. 🚚\n\n"
                f"Para o seu CEP, o **frete é grátis** em compras a partir de **{fmt_brl(thr)}**.",
                intent="shipping", topic="Frete & Envio", confidence=0.6)
        opts = sorted(options, key=lambda o: float(o.get("price") or 0))
        cheapest = opts[0]
        fastest = min(opts, key=lambda o: (o.get("delivery_time") or 99))
        lines = [f"• **{o.get('company')} {o.get('name')}** — {fmt_brl(float(o['price']))}"
                 + (f", até {o.get('delivery_time')} dias úteis" if o.get("delivery_time") else "") for o in opts[:4]]
        base = "1 unidade" if len(chosen) <= 1 else f"{len(chosen)} produtos"
        txt = ("Frete para o CEP **%s-%s** (estimativa com %s; o valor final depende do peso do carrinho): 🚚\n\n%s\n\n"
               % (cep[:5], cep[5:], base, "\n".join(lines)))
        txt += f"Mais barata: **{cheapest.get('company')} {cheapest.get('name')}**"
        if fastest is not cheapest:
            txt += f" · Mais rápida: **{fastest.get('company')} {fastest.get('name')}**"
        txt += f".\n\n🎁 No seu CEP o frete é **grátis** a partir de **{fmt_brl(thr)}** (aplicamos a opção mais barata)."
        return LiaResult(txt, product_ids=[x.id for x in chosen], intent="shipping", topic="Frete & Envio", confidence=0.95,
                         suggestions=["Ver promoções", "Formas de pagamento"])

    def _free_shipping(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(self.free_ship_text() + "\n\nMe envie seu CEP e eu calculo as opções para você. 🚚",
                         intent="free_shipping", topic="Frete & Envio", confidence=0.9, suggestions=["Calcular frete"])

    def _order_status(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "Para acompanhar seu pedido: entre na sua conta e abra **Meus pedidos** — lá aparecem o status e o código de rastreio "
            "assim que a etiqueta é emitida. 📦\n\nSe comprou como visitante ou o rastreio não aparece, nossa equipe consulta pra você pelo número do pedido.",
            intent="order_status", topic="Frete & Envio", confidence=0.85, suggestions=["Falar com atendente"])

    def _returns(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "Sem problemas, vamos resolver. 💚 Por lei (Código de Defesa do Consumidor), compras online podem ser desistidas em até **7 dias** após o recebimento. "
            "Para trocas, devoluções ou produto com problema, nossa equipe cuida do seu caso pessoalmente — tenha o número do pedido em mãos.",
            intent="returns", confidence=0.8, suggestions=["Falar com atendente"])

    def _payment(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "Formas de pagamento: 💳\n\n• **PIX** — aprovação imediata;\n• **Cartão de crédito** — até 3x sem juros (ou até 12x);\n"
            "• **Pagamento combinado** — divida a mesma compra entre PIX e cartão.\n\nVocê pode comprar como visitante, sem criar conta.",
            intent="payment", topic="Pagamentos", confidence=0.95, suggestions=["Cupom de desconto", "Calcular frete"])

    def _coupon(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "Cupom **PRIMEIRACOMPRA**: 10% de desconto na primeira compra de varejo (vale para quem ainda não tem pedido pago). 🎁\n\n"
            "Os produtos já estão com preços promocionais no site. No atacado, o desconto de 45% é aplicado automaticamente (não soma com cupom).",
            intent="coupon", topic="Pagamentos", confidence=0.9, suggestions=["Ver promoções", "Atacado"])

    def _wholesale(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "Quer revender? Ótimo! 🌿 No **atacado Ecosopis**, a partir de **10 unidades** dos produtos de atacado você ganha **45% de desconto** automático no carrinho — "
            "pode misturar produtos. Veja a página *Quero Revender* no menu ou me diga o que pretende comprar que eu calculo o valor.",
            intent="wholesale", confidence=0.9, suggestions=["Calcular 10 sabonetes", "Calcular frete"])

    def _promo(self, message, t, prods, concerns) -> LiaResult:
        on = [i for i in self.items if i.on_sale and i.sale_price and i.sale_price < i.price]
        if not on:
            return LiaResult("No momento não há produtos em promoção, mas o cupom **PRIMEIRACOMPRA** dá 10% na primeira compra. 🎁",
                             intent="promo", confidence=0.8)
        offs = [round((1 - i.sale_price / i.price) * 100) for i in on]
        top = on[:3]
        return LiaResult(
            f"Estamos com **{len(on)} produtos em promoção** (até **{max(offs)}% OFF**)! 🎉 Alguns exemplos:\n\n" + "\n".join(f"• **{i.name}** — {self.price_line(i)}" for i in top)
            + "\n\nA seção *Em Promoção* da página inicial mostra todos. E o frete é grátis acima de "
            f"{fmt_brl(FREE_SHIPPING_SOUTH_SOUTHEAST)} (Sul/Sudeste).",
            product_ids=[i.id for i in top], intent="promo", confidence=0.9, suggestions=["Montar uma rotina", "Calcular frete"])

    def _human(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult("Claro! Nossa equipe de especialistas atende pelo WhatsApp — é só clicar no botão abaixo. 💚",
                         intent="human", topic="Atendimento Humano", confidence=0.95)

    def _safety(self, message, t, prods, concerns) -> LiaResult:
        g = self.has(t, "gravida", "gestante", "gravidez", "amamentando", "amamentacao", "lactante")
        kid = self.has(t, "bebe", "crianca", "filho")
        if g:
            txt = ("Na **gestação e amamentação** o cuidado é redobrado. 💚 Produtos de uso externo suaves, como sabonetes, costumam ser usados, "
                   "mas **óleos essenciais** (lavanda, menta, melaleuca, alecrim, laranja) devem ser evitados, pois são concentrados e alguns não são recomendados nesse período. "
                   "Antes de iniciar qualquer produto novo, converse com seu obstetra ou dermatologista.")
        elif kid:
            txt = ("Para **bebês e crianças**, recomendo conversar com o pediatra antes de usar qualquer produto novo — a pele deles é bem mais sensível. "
                   "Óleos essenciais não são indicados para crianças pequenas.")
        else:
            txt = ("Se você tem **alergia, usa medicamentos ou faz algum tratamento**, o ideal é conferir os ingredientes do produto (posso listar para você) "
                   "e fazer o **teste de toque** em uma área pequena por 24h. Em caso de dúvida, consulte seu médico ou dermatologista.")
        return LiaResult(txt, intent="safety", confidence=0.85, suggestions=["Ver ingredientes", "Falar com atendente"])

    def _brand(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "A Ecosopis é uma marca brasileira de cosméticos **100% naturais, veganos e artesanais**, sem sulfatos agressivos, parabenos, silicones, "
            "derivados de petróleo e **sem crueldade animal**. 🌱 Os ingredientes de cada produto estão na página dele (e eu posso listar aqui).",
            intent="brand_values", confidence=0.9, suggestions=["Ver ingredientes de um produto", "Montar uma rotina"])

    def _about(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "Sou a **Lia**, a consultora virtual da Ecosopis. 🌿 Eu indico produtos para sua queixa, monto rotinas, explico modo de uso e ingredientes, "
            "calculo frete pelo CEP, tiro dúvidas de pagamento e atacado — e, quando precisar, chamo nossa equipe humana.",
            intent="about_lia", confidence=0.9, suggestions=["Tenho foliculite", "Pele oleosa", "Calcular frete"])

    def _how_to_buy(self, message, t, prods, concerns) -> LiaResult:
        return LiaResult(
            "É bem simples! 🛒\n\n1. Escolha os produtos (aqui comigo ou na página *Produtos*) e clique em **Adicionar ao carrinho**.\n"
            "2. No carrinho, informe o **CEP** para ver as opções de frete (da mais barata para a mais cara).\n"
            "3. Finalize com **PIX**, **cartão** (até 3x sem juros) ou **PIX + cartão**. Não precisa criar conta.\n\n" + self.free_ship_text(),
            intent="how_to_buy", confidence=0.9, suggestions=["Formas de pagamento", "Ver promoções", "Calcular frete"])

    def _catalog(self, message, t, prods, concerns) -> LiaResult:
        groups = {"Sabonetes": [], "Óleos e aromaterapia": [], "Cremes e cuidados": [], "Kits": []}
        for i in self.items:
            n = norm(i.name)
            if i.is_kit:
                groups["Kits"].append(i)
            elif n.startswith("sabonete"):
                groups["Sabonetes"].append(i)
            elif "oleo" in n or "manteiga" in n:
                groups["Óleos e aromaterapia"].append(i)
            else:
                groups["Cremes e cuidados"].append(i)
        lines = []
        for g, its in groups.items():
            if its:
                lines.append(f"**{g}** ({len(its)}): " + ", ".join(i.name for i in its[:4]) + ("..." if len(its) > 4 else ""))
        return LiaResult("Nosso catálogo: 🌿\n\n" + "\n".join(lines) + "\n\nMe conte o que quer cuidar e eu indico os ideais para você.",
                         intent="catalog", confidence=0.85, suggestions=["Pele oleosa", "Manchas", "Queda de cabelo"])

    def _gift(self, message, t, prods, concerns) -> LiaResult:
        kits = [i for i in self.items if i.is_kit and i.available][:3]
        txt = "Os **kits** são ótimos para presentear: 🎁\n\n" + "\n".join(self.card(i) for i in kits) if kits else \
            "Uma combinação de sabonetes + óleo faz um presente lindo. Me conte o perfil de quem vai receber!"
        return LiaResult(txt, product_ids=[i.id for i in kits], intent="gift", confidence=0.8, suggestions=["Calcular frete"])
