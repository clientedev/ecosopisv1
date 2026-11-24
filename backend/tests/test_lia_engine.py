"""Testes do motor da LIA (sem rede, sem chave de API). Rode: python -m pytest tests/test_lia_engine.py -q"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.core.lia_engine import Item, LiaEngine  # noqa: E402

# (id, nome, slug, preço, tags, descrição, benefícios, ingredientes, modo de uso)
RAW = [
    (38, "Tônico Capilar Anti Queda", "tonico-capilar-anti-queda", 33.91, ["JABORANDI", "ALECRIM", "PANTENOL", "MENTA PIPERITA"], "Tônico para couro cabeludo com jaborandi e alecrim.", "Estimula a microcirculação e fortalece os fios.", "Jaborandi, Alecrim, Pantenol, Menta", "Aplique no couro cabeludo limpo e massageie."),
    (1, "Sabonete de Açafrão e Dolomita", "sabonete-acafrao-dolomita", 15.9, ["sabonete", "acafrao", "dolomita", "skin:oily", "acne", "foliculite"], "Sabonete ideal para tratamento de foliculite e renovação celular.", "Ação anti-inflamatória, clareadora e cicatrizante.", "Açafrão, Barbatimão e Dolomita", "Aplique sobre a pele molhada, massageando com movimentos circulares. Deixe agir por 3 minutos e enxágue. Uso diário."),
    (42, "Óleo Essencial de Alecrim", "oleo-essencial-de-alecrim", 17.9, ["OLEO ESSENCIAL", "ALECRIM"], "Óleo essencial puro de alecrim.", "Estimulante, aromaterapia e couro cabeludo.", "Rosmarinus officinalis", "Diluir em óleo carreador."),
    (39, "Óleo Vegetal Centella Ásiatica", "oleo-vegetal-centella-asiatica", 15.9, ["ÓLEO", "OIL", "CENTELLA ASIÁTICA"], "Óleo vegetal de centella.", "Regeneração e elasticidade da pele.", "Centella asiática", "Aplicar à noite na pele limpa."),
    (40, "Óleo Vegetal de Jojoba", "oleo-vegetal-de-jojoba", 22.0, ["OLEO", "JOJOBA", "HIDRATAÇÃO"], "Óleo vegetal de jojoba.", "Hidratação leve e equilíbrio da pele.", "Jojoba", "Aplicar na pele levemente úmida."),
    (41, "Óleo Vegetal de Copaíba", "oleo-vegetal-de-copaiba", 19.0, ["OLEO", "COPAÍBA", "NUTRIÇÃO"], "Óleo de copaíba.", "Nutrição e regeneração.", "Copaíba", "Aplicar na região desejada."),
    (26, "Kit Sabonetes Açafrão e Argila Branca", "kit-acafrao-argila", 29.5, ["kit", "spots", "foliculite"], "Kit com dois sabonetes.", "Foliculite e manchas.", "Açafrão, argila branca", "Alternar o uso."),
    (27, "Kit Clareamento Potente", "kit-clareamento", 31.9, ["kit", "spots", "facial", "CLAREAMENTO"], "Kit para clareamento.", "Uniformiza manchas.", "Argila branca, rosa mosqueta", "Sabonete no banho e óleo à noite."),
    (23, "Óleo Essencial Melaleuca (Tea Tree) 100% Puro", "oe-melaleuca", 17.9, ["acne", "skin:oily", "OLEO ESSENCIAL"], "Melaleuca pura.", "Ação antibacteriana.", "Melaleuca alternifolia", "Sempre diluído."),
    (25, "Kit para Acne e Oleosidade", "kit-acne", 44.9, ["kit", "acne", "skin:oily", "OLEOSIDADE"], "Kit completo para acne.", "Controla oleosidade e acne.", "Argila verde, calêndula", "Use diariamente."),
    (21, "Óleo Essencial Lavanda Francesa 100% Puro", "oe-lavanda", 17.9, ["oe", "sensitivity", "aromaterapia", "RELAXAMENTO"], "Lavanda francesa.", "Calmante natural.", "Lavandula", "Difusor."),
    (24, "Óleo Essencial Laranja Doce 100% Puro", "oe-laranja", 15.0, ["detox", "alegria", "OLEO ESSENCIAL"], "Laranja doce.", "Alegria e detox.", "Citrus sinensis", "Difusor."),
    (22, "Óleo Essencial Menta Piperita 100% Puro", "oe-menta", 16.9, ["hair:oily", "frescor", "OLEO ESSENCIAL"], "Menta piperita.", "Frescor e couro cabeludo oleoso.", "Mentha piperita", "Diluir."),
    (20, "Óleo Vegetal de Argan 100% Puro", "oleo-argan", 15.9, ["oleo", "hair:dry", "hair"], "Argan puro.", "Nutre os cabelos e reduz frizz.", "Argania spinosa", "Nas pontas."),
    (18, "Óleo Vegetal de Rícino 100% Puro", "oleo-ricino", 12.9, ["oleo", "hair:damaged", "hair"], "Rícino puro.", "Fortalece fios, cílios e sobrancelhas.", "Ricinus communis", "Antes de dormir."),
    (19, "Óleo Vegetal de Abacate 100% Puro", "oleo-abacate", 12.9, ["oleo", "skin:dry", "hair:dry", "HIDRATAÇÃO"], "Abacate puro.", "Hidratação profunda.", "Persea gratissima", "Na pele úmida."),
    (6, "Sabonete de Rosa Mosqueta e Argila Rosa", "sabonete-rosa-mosqueta-argila-rosa", 15.9, ["sabonete", "hidratante", "skin:dry", "sensitivity"], "Sabonete suave.", "Hidrata e regenera peles sensíveis.", "Rosa mosqueta, argila rosa", "Na pele úmida."),
    (17, "Óleo Vegetal de Semente de Uva 100% Puro", "oleo-semente-uva", 11.9, ["oleo", "hidratante", "skin:normal", "DERMATITE"], "Semente de uva.", "Hidratação leve.", "Vitis vinifera", "À noite."),
    (16, "Óleo Vegetal de Alecrim 100% Puro", "oleo-alecrim", 15.9, ["oleo", "hair:damaged", "hair:oily", "hair"], "Alecrim vegetal.", "Estimula crescimento capilar.", "Alecrim", "Umectação."),
    (15, "Refil 60ml Óleo de Rosa Mosqueta Rubiginosa 100% Puro", "refil-rosa-mosqueta", 35.87, ["oleo", "refil", "spots", "CLAREAMENTO"], "Refil de 60ml.", "Regenera e clareia.", "Rosa mosqueta", "À noite."),
    (5, "Sabonete de Carvão Ativado", "sabonete-carvao-ativado", 15.9, ["sabonete", "carvao", "skin:mixed", "skin:oily"], "Sabonete detox.", "Desobstrui poros e remove cravos.", "Carvão ativado", "No rosto úmido."),
    (14, "Óleo Vegetal de Rosa Mosqueta Rubiginosa 100% puro", "oleo-rosa-mosqueta-20ml", 18.9, ["oleo", "spots", "facial", "CLAREAMENTO"], "Rosa mosqueta 20ml.", "Regenerador, ameniza manchas e cicatrizes.", "Rosa mosqueta", "À noite."),
    (4, "Sabonete de Argila Verde", "sabonete-argila-verde", 15.9, ["sabonete", "argila-verde", "skin:oily", "acne"], "Sabonete para pele oleosa.", "Controla oleosidade e seca espinhas.", "Argila verde", "No rosto úmido."),
    (12, "Manteiga de Ojon – Cabelo e Corpo", "manteiga-ojon", 35.0, ["manteiga", "hair:damaged", "hair:dry", "hidratante"], "Manteiga nutritiva.", "Nutre cabelo e corpo.", "Ojon", "Nas pontas."),
    (2, "Sabonete Clareador de Argila Branca e Dolomita", "sabonete-clareador-argila-branca", 15.9, ["sabonete", "clareador", "spots", "skin:normal"], "Sabonete clareador.", "Clareia manchas suavemente.", "Argila branca, dolomita", "Deixe agir 3 minutos."),
    (11, "Tônico Facial Antioxidante", "tonico-facial-antioxidante", 14.9, ["tonico", "antioxidante", "facial", "todos-os-tipos"], "Tônico facial.", "Protege e equilibra a pele.", "Extratos vegetais", "Após a limpeza."),
    (8, "Creme para Oleosidade e Acne Natural", "creme-oleosidade-acne", 16.9, ["creme", "acne", "skin:oily", "facial"], "Creme de toque seco.", "Reduz vermelhidão e previne espinhas.", "Calêndula, chá verde", "Manhã e noite."),
    (10, "Desodorante Clareador Sólido", "desodorante-clareador-solido", 19.9, ["desodorante", "clareador", "spots"], "Desodorante sem alumínio.", "Neutraliza odores e clareia axilas.", "Argila branca, magnésio, karité", "Axilas limpas e secas."),
    (7, "Sabonete Líquido de Barbatimão e Calêndula 3 em 1", "sabonete-liquido-barbatimao", 21.9, ["sabonete-liquido", "barbatimao", "sensitivity", "RELAXANTE"], "Sabonete líquido 3 em 1.", "Limpa sem repuxar.", "Barbatimão, calêndula", "Na palma da mão."),
    (9, "Creme para Rachaduras – Pés de Anjo", "creme-pes-de-anjo", 17.9, ["creme", "pes", "hidratante"], "Creme para pés.", "Recupera calcanhares rachados.", "Barbatimão, aloe, copaíba, ureia", "À noite."),
    (3, "Sabonete Íntimo de Barbatimão com Calêndula", "sabonete-intimo-barbatimao", 15.9, ["sabonete", "intimo", "barbatimao", "sensitivity"], "Sabonete íntimo.", "Cuidado íntimo diário.", "Barbatimão, calêndula", "Região externa."),
]


def catalog():
    items = []
    for (i, name, slug, price, tags, desc, ben, ing, uso) in RAW:
        items.append(Item(id=i, name=name, slug=slug, price=price, sale_price=round(price * 0.85, 2), on_sale=True, stock=100,
                          tags=tags, description=desc, benefits=ben, ingredients=ing, modo_de_uso=uso, is_wholesale=not slug.startswith("kit")))
    return items


def fake_quote(cep, items):
    if cep == "76720000":
        return [], "CEP de destino inválido"
    return [
        {"id": 2, "name": "SEDEX", "price": 21.5, "delivery_time": 2, "company": "Correios"},
        {"id": 31, "name": "Express", "price": 14.3, "delivery_time": 4, "company": "Loggi"},
        {"id": 1, "name": "PAC", "price": 17.0, "delivery_time": 6, "company": "Correios"},
    ], None


E = LiaEngine(catalog(), quote_fn=fake_quote)


def ask(msg, hist=None):
    return E.answer(msg, hist or [])


def names(r):
    by = {i.id: i.name for i in E.items}
    return [by[i] for i in r.product_ids]


def test_foliculite_recommends_acafrao():
    r = ask("tenho foliculite na virilha, o que uso?")
    assert r.intent == "recommend" and "Açafrão" in names(r)[0] and "3 minutos" in r.reply and r.confidence >= 0.8


def test_typos_are_corrected():
    assert "Açafrão" in names(ask("tenho folicullite e pelos encravdos"))[0]
    assert ask("quero clarear manchs").product_ids


def test_acne_oily():
    r = ask("minha pele é oleosa e tenho muita espinha")
    assert any("Argila Verde" in n or "Acne" in n for n in names(r))


def test_promo_price_shown():
    r = ask("quanto custa o sabonete de argila verde?")
    assert "R$ 13,52" in r.reply and "15% OFF" in r.reply


def test_followup_how_to_use_uses_history():
    h = [{"role": "user", "content": "tenho foliculite"},
         {"role": "assistant", "content": "Para **foliculite**, eu indico:\n• **Sabonete de Açafrão e Dolomita** (R$ 13,52)"}]
    r = ask("e como eu uso?", h)
    assert r.intent == "how_to_use" and "3 minutos" in r.reply and "Açafrão" in r.reply


def test_followup_price():
    h = [{"role": "assistant", "content": "Recomendo o **Tônico Facial Antioxidante**."}]
    r = ask("quanto custa?", h)
    assert r.intent == "price" and "R$ 12,66" in r.reply or "R$ 12,67" in r.reply


def test_skin_type_answer_after_question():
    h = [{"role": "user", "content": "quero uma rotina pro rosto"},
         {"role": "assistant", "content": "Qual é o seu tipo de pele? oleosa, seca, mista ou sensível"}]
    r = ask("oleosa", h)
    assert r.product_ids and r.intent in {"recommend", "routine"}


def test_vague_request_asks_diagnostic():
    r = ask("me indica algum produto")
    assert r.intent == "recommend" and "objetivo" in r.reply and not r.product_ids


def test_shipping_with_cep_uses_real_quote_and_cheapest():
    r = ask("calcula o frete pro cep 01310-100")
    assert r.intent == "shipping" and "Loggi Express" in r.reply and "Mais barata" in r.reply and "148,90" in r.reply


def test_invalid_cep():
    assert "CEP" in ask("frete para 76720000").reply and "Confira" in ask("frete para 76720000").reply


def test_free_shipping_rules():
    r = ask("tem frete grátis?")
    assert "148,90" in r.reply and "248,90" in r.reply


def test_payment_and_coupon_and_wholesale():
    assert "PIX" in ask("quais as formas de pagamento?").reply
    assert "PRIMEIRACOMPRA" in ask("tem cupom de desconto?").reply
    assert "45%" in ask("quero revender, tem atacado?").reply


def test_calc_total_and_wholesale():
    r = ask("quanto fica 10 sabonete de argila verde?")
    assert r.intent == "calc" and "atacado" in r.reply.lower()
    r2 = ask("quanto ficam 2 sabonete de carvão ativado")
    assert "R$ 27,04" in r2.reply


def test_pregnancy_safety():
    r = ask("estou grávida, posso usar óleo essencial?")
    assert r.intent == "safety" and "óleos essenciais" in r.reply.lower()


def test_brand_values_and_about():
    assert "veganos" in ask("os produtos são veganos?").reply
    assert "Lia" in ask("quem é você?").reply


def test_search_by_ingredient():
    r = ask("tem algo com copaíba?")
    assert any("Copaíba" in n or "Pés de Anjo" in n for n in names(r))


def test_hair_loss():
    r = ask("meu cabelo está caindo muito")
    assert "Tônico Capilar" in names(r)[0]


def test_compare_two_products():
    r = ask("qual a diferença entre o sabonete de argila verde e o de carvão ativado?")
    assert r.intent == "compare" and len(r.product_ids) == 2


def test_oils_have_night_use_warning():
    r = ask("como usar o óleo de rosa mosqueta?")
    assert "à noite" in r.reply.lower() or "noite" in r.reply.lower()


def test_greeting_and_unknown():
    assert ask("oi").intent == "greeting"
    r = ask("blablabla xyz")
    assert r.confidence < 0.3


def test_human_request():
    assert ask("quero falar com um atendente").intent == "human"


def test_doctor_warning_for_intimate():
    assert "médica" in ask("sabonete íntimo para corrimento").reply


def test_ambiguous_product_asks_which():
    r = ask("como usar o sabonete de argila?")
    assert "mais de um" in r.reply or len(r.product_ids) >= 1


def test_multiturn_primary_product_from_list():
    first = ask("tenho foliculite")
    h = [{"role": "user", "content": "tenho foliculite"}, {"role": "assistant", "content": first.reply}]
    r = ask("e como eu uso?", h)
    assert r.intent == "how_to_use" and "Açafrão" in r.reply and "3 minutos" in r.reply and "é só pedir" in r.reply


def test_pick_how_to_buy_and_no_wrong_correction():
    assert ask("como comprar?").intent == "how_to_buy"
    assert ask("quero comprar 12 sabonetes de carvao ativado").intent == "calc"


def test_hair_dry_not_skin():
    r = ask("meu cabelo é ressecado")
    assert "Manteiga de Ojon" in names(r)[0] or "Argan" in names(r)[0]
