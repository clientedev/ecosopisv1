"""
Testes de ponta a ponta do fluxo de compra (backend real + SQLite).
Mercado Pago e Melhor Envio são simulados com respostas no formato das APIs reais.

Como rodar:  cd backend && python tests/test_checkout_flow.py
"""
import itertools
import os
import sys
import tempfile
import time

DB_FILE = os.path.join(tempfile.mkdtemp(), "ecosopis_test.db")
os.environ.update({
    "DATABASE_URL": f"sqlite:///{DB_FILE}",
    "MP_ACCESS_TOKEN": "TEST-FAKE",
    "MELHORENVIO_TOKEN": "FAKE",
    "POST_PAYMENT_TASKS_SYNC": "1",
    "SECRET_KEY": "test-secret",
    "FRONTEND_URL": "https://ecosopis.com.br",
})
for k in ("POSTGRES_URL", "DATABASE_PUBLIC_URL"):
    os.environ.pop(k, None)

# ── Fake Mercado Pago SDK ────────────────────────────────────────────────────
import mercadopago  # noqa: E402

MP = {"payments": {}, "prefs": {}}
_ids = itertools.count(9000001)


class _Payment:
    def create(self, data, request_options=None):
        pid = str(next(_ids))
        approve = data.get("token") == "tok_approve"
        status = "approved" if approve else ("rejected" if data.get("token") == "tok_reject" else "pending")
        p = {
            "id": int(pid), "status": status, "status_detail": "accredited" if approve else "pending_waiting_transfer",
            "external_reference": data.get("external_reference"), "transaction_amount": data["transaction_amount"],
            "currency_id": "BRL", "payer": data.get("payer", {}), "payment_type_id": "bank_transfer" if data.get("payment_method_id") == "pix" else "credit_card",
            "payment_method_id": data.get("payment_method_id"), "description": data.get("description"),
            "point_of_interaction": {"transaction_data": {"qr_code": f"PIX-{pid}", "qr_code_base64": "b64", "ticket_url": "https://mp/t"}},
        }
        MP["payments"][pid] = p
        return {"status": 201, "response": p}

    def get(self, pid):
        p = MP["payments"].get(str(pid))
        return {"status": 200, "response": p} if p else {"status": 404, "response": {}}

    def search(self, filters):
        ref = filters.get("external_reference")
        return {"status": 200, "response": {"results": [p for p in MP["payments"].values() if p["external_reference"] == ref]}}


class _Pref:
    def create(self, data):
        pid = f"pref-{len(MP['prefs']) + 1}"
        MP["prefs"][pid] = data
        return {"status": 201, "response": {"id": pid, "init_point": f"https://mp/checkout/{pid}"}}


class _MO:
    def get(self, i): return {"status": 404, "response": {}}
    def search(self, f): return {"status": 200, "response": {"elements": []}}


class FakeSDK:
    def __init__(self, *a, **k): pass
    def payment(self): return _Payment()
    def preference(self): return _Pref()
    def merchant_order(self): return _MO()


mercadopago.SDK = FakeSDK

sys.path.insert(0, os.environ.get("BACKEND_DIR") or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Fake Melhor Envio quote + silence side effects ───────────────────────────
from app.core import melhorenvio_service as core_me  # noqa: E402

QUOTE = [
    {"id": 1, "name": "PAC", "price": 18.40, "delivery_time": 5, "company": "Correios"},
    {"id": 2, "name": "SEDEX", "price": 25.10, "delivery_time": 2, "company": "Correios"},
    {"id": 31, "name": "Express", "price": 12.30, "delivery_time": 2, "company": "Loggi"},
]
ME_CALLS = {"n": 0, "down": False}


def fake_calc(cls, dest_cep, items, timeout=20, attempts=2):
    ME_CALLS["n"] += 1
    if ME_CALLS["down"]:
        return [], "Timeout"
    return [dict(o) for o in QUOTE], None


core_me.MelhorEnvioService.calculate_shipping = classmethod(fake_calc)

from app.main import app  # noqa: E402
from app.api.endpoints import payment as pay_mod  # noqa: E402
from app.core import emails  # noqa: E402

SENT = {"me": 0}
pay_mod.processar_envio = lambda pedido, db: SENT.__setitem__("me", SENT["me"] + 1) or {"shipment_id": "SHP1"}
for name in dir(emails):
    if name.startswith("send_"):
        setattr(emails, name, lambda *a, **k: None)
import app.services.whatsapp as wa  # noqa: E402
for name in dir(wa):
    if name.startswith(("notify_", "trigger_")):
        setattr(wa, name, lambda *a, **k: None)

from fastapi.testclient import TestClient  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models import models  # noqa: E402
from app.core import security  # noqa: E402

from app.core.database import engine  # noqa: E402
models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
client.__enter__()  # dispara o startup (migrações)
db = SessionLocal()

# ── Seed ──────────────────────────────────────────────────────────────────────
def mk_product(name, price, stock=50, sale=None, wholesale=False):
    p = models.Product(name=name, slug=name.lower().replace(" ", "-"), description="x", price=price, stock=stock,
                       is_active=True, buy_on_site=True, is_on_sale=bool(sale), sale_price=sale, is_wholesale=wholesale, tags=[])
    db.add(p); db.commit(); db.refresh(p); return p


P_SOAP = mk_product("Sabonete Argila", 40.0)
P_SERUM = mk_product("Serum Botanico", 100.0, sale=80.0)
P_WHOLE = mk_product("Sabonete Atacado", 20.0, stock=100, wholesale=True)
P_CHEAP = mk_product("Amostra", 5.0)


def mk_user(email, role="client", cpf=None):
    u = models.User(email=email, full_name="Teste " + email.split("@")[0], role=role, is_verified=True,
                    hashed_password=security.get_password_hash("x"), cpf=cpf)
    db.add(u); db.commit(); db.refresh(u)
    return u, {"Authorization": "Bearer " + security.create_access_token(str(u.id))}


ADMIN, H_ADMIN = mk_user("admin@eco.com", "admin")
ALICE, H_ALICE = mk_user("alice@eco.com", cpf="52998224725")
BOB, H_BOB = mk_user("bob@eco.com", cpf="11144477735")
db.add(models.Coupon(code="DEZ", discount_type="percentage", discount_value=10, is_active=True, usage_count=0, usage_limit=1))
db.commit()

CEP_SP = "01310100"
ADDR = {"street": "Av Paulista", "number": "1000", "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP", "postal_code": CEP_SP}


def payload(items, shipping=18.40, service=1, cpf="52998224725", email="alice@eco.com", **extra):
    d = {"items": items, "total": 1, "shipping_price": shipping, "shipping_service_id": service, "customer_cpf": cpf,
         "customer_email": email, "customer_name": "Alice Teste", "customer_phone": "11999990000", "address": dict(ADDR, email=email)}
    d.update(extra)
    return d


def item(p, qty=1, price=None, name=None):
    return {"product_id": p.id, "product_name": name or p.name, "quantity": qty, "price": p.price if price is None else price}


def approve(pid, amount=None):
    MP["payments"][str(pid)]["status"] = "approved"
    MP["payments"][str(pid)]["status_detail"] = "accredited"
    if amount is not None:
        MP["payments"][str(pid)]["transaction_amount"] = amount


def webhook(pid):
    return client.post("/api/payment/webhook/mercadopago", json={"type": "payment", "data": {"id": str(pid)}})


def order(oid):
    db.expire_all(); return db.query(models.Order).filter(models.Order.id == oid).first()


RESULTS = []


def check(name, cond, info=""):
    RESULTS.append((name, bool(cond)))
    print(("  ✅ " if cond else "  ❌ ") + name + (f"  [{info}]" if info and not cond else ""))


# ═════════════════════════════════════════════════════════════════════════════
print("\n▶ 1. PIX (cliente logado) — preço adulterado e frete corretos")
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE,
                json=payload([item(P_SOAP, 2, price=0.01), item(P_SERUM, 1, price=1)]))
check("PIX criado (200)", r.status_code == 200, r.text[:200])
d = r.json(); oid1 = d.get("order_id"); pid1 = d.get("payment_id")
check("total recalculado no servidor = 2×40 + 80 (promo) + 18,40", abs(d.get("total", 0) - 178.40) < 0.01, d.get("total"))
check("valor do PIX no Mercado Pago = total do pedido", abs(MP["payments"][pid1]["transaction_amount"] - 178.40) < 0.01)
check("QR code devolvido", d.get("qr_code") == f"PIX-{pid1}")

print("\n▶ 2. Frete adulterado")
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SOAP)], shipping=0))
check("frete 0 abaixo do mínimo para frete grátis → 400", r.status_code == 400, r.text[:150])
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SOAP)], shipping=3.00))
check("frete R$ 3,00 abaixo da cotação → 400", r.status_code == 400, r.text[:150])
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SOAP)], shipping=16.90, service=1))
check("frete da tabela de contingência (PAC SP R$ 16,90) aceito", r.status_code == 200, r.text[:150])
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 2)], shipping=0, service=31))
check("frete grátis acima de R$ 148,90 na opção mais barata → aceito", r.status_code == 200, r.text[:150])
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 2)], shipping=0, service=2))
check("frete grátis no SEDEX (não é a mais barata) → 400", r.status_code == 400, r.text[:150])
ME_CALLS["down"] = True
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE,
                json=payload([item(P_SOAP, 3)], shipping=16.90, service=1, address=dict(ADDR, postal_code="01001000")))
check("Melhor Envio fora do ar: frete da tabela de contingência ainda aceito", r.status_code == 200, r.text[:150])
ME_CALLS["down"] = False

print("\n▶ 3. Quantidade e atacado")
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 3), item(P_SOAP, -2)]))
check("quantidade negativa → 400", r.status_code == 400, r.text[:120])
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE,
                json=payload([item(P_SOAP, 10, price=22.0, name="Sabonete Argila (Atacado)")], shipping=0, service=31))
check("'(Atacado)' falso num produto comum → preço normal (400,00 + frete grátis)", r.status_code == 200 and abs(r.json()["total"] - 400.0) < 0.01, r.text[:150])
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE,
                json=payload([item(P_WHOLE, 10, price=11.0, name="Sabonete Atacado (Atacado)")], shipping=18.40))
check("atacado legítimo (10 un × 20 × 0,55 = 110 + 18,40)", r.status_code == 200 and abs(r.json()["total"] - 128.40) < 0.01, r.text[:150])

print("\n▶ 4. Fraude: quitar pedido caro com pagamento de outro pedido")
r = client.post("/api/payment/process-transparent-pix", headers=H_BOB,
                json=payload([item(P_CHEAP)], shipping=18.40, cpf="11144477735", email="bob@eco.com"))
cheap_oid, cheap_pid = r.json()["order_id"], r.json()["payment_id"]
approve(cheap_pid)
r = client.get(f"/api/payment/status/{oid1}?payment_id={cheap_pid}")
check("pedido de R$ 178,40 NÃO é quitado com o pagamento do pedido de R$ 23,40", order(oid1).status == "pending", order(oid1).status)
webhook(cheap_pid)
check("webhook quita o pedido barato correto", order(cheap_oid).status == "paid", order(cheap_oid).status)

print("\n▶ 5. Fraude: pagamento aprovado com valor menor")
approve(pid1, amount=50.00)
webhook(pid1)
check("pedido NÃO quitado com R$ 50 de R$ 178,40", order(oid1).status == "pending", order(oid1).status)
hist = db.query(models.OrderPaymentHistory).filter_by(order_id=oid1, new_status="under_review").first()
check("divergência registrada no histórico para o admin", hist is not None)

print("\n▶ 6. Pagamento correto pelo webhook")
approve(pid1, amount=178.40)
stock_before = db.query(models.Product).get(P_SOAP.id).stock
r = webhook(pid1)
check("webhook responde 200", r.status_code == 200)
o = order(oid1)
check("pedido quitado (paid)", o.status == "paid", o.status)
check("estoque baixado (−2 sabonetes)", db.query(models.Product).get(P_SOAP.id).stock == stock_before - 2)
check("pedido enviado ao carrinho da Melhor Envio", SENT["me"] >= 2, SENT)
webhook(pid1)
check("webhook repetido não baixa estoque de novo (idempotente)", db.query(models.Product).get(P_SOAP.id).stock == stock_before - 2)

print("\n▶ 7. Reaproveitar pedido de outra pessoa / pedido já pago")
r = client.post("/api/payment/process-transparent-pix", headers=H_BOB,
                json=payload([item(P_CHEAP)], cpf="11144477735", email="bob@eco.com", order_id=oid1))
check("Bob não altera o pedido da Alice (novo pedido criado)", r.status_code == 200 and r.json()["order_id"] != oid1, r.text[:120])
check("pedido da Alice intacto", order(oid1).status == "paid" and abs(order(oid1).total - 178.40) < 0.01)
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 5)], order_id=oid1))
check("pedido pago não é reaberto (novo pedido)", r.json().get("order_id") != oid1, r.text[:120])

print("\n▶ 8. Visitante + acesso aos dados")
r = client.post("/api/payment/process-transparent-pix",
                json=payload([item(P_SOAP)], cpf="39053344705", email="visitante@eco.com"))
check("compra como visitante (200)", r.status_code == 200, r.text[:150])
g = r.json(); goid, gtok = g["order_id"], g["guest_access_token"]
r = client.get(f"/api/payment/status/{goid}")
check("status sem token: só o status, sem QR/histórico", r.status_code == 200 and r.json()["payment_details"] == {} and r.json()["payment_transactions"] == [])
r = client.get(f"/api/payment/status/{goid}?guest_token={gtok}")
check("status com token: dados completos", r.status_code == 200 and len(r.json()["payment_transactions"]) == 1)
r = client.get(f"/api/payment/status/{goid}", headers=H_BOB)
check("outro cliente logado → 403", r.status_code == 403)
r = client.get(f"/api/orders/{goid}?email=visitante@eco.com")
j = r.json()
check("consulta por e-mail: CPF/telefone/rua ocultos", r.status_code == 200 and "street" not in (j.get("address") or {}) and j["customer_cpf"].startswith("*"), str(j.get("address")))
r = client.get(f"/api/orders/{goid}?guest_token={gtok}")
check("consulta com token: endereço completo", r.json()["address"].get("street") == "Av Paulista")

print("\n▶ 9. Cupons, primeira compra e cashback")
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 1)], coupon_code="PRIMEIRACOMPRA", cpf="52998224725"))
check("PRIMEIRACOMPRA negado para quem já tem pedido pago (mesmo CPF)", r.json().get("total") == 98.40, r.json().get("total"))
r = client.post("/api/payment/process-transparent-pix", json=payload([item(P_SERUM, 1)], coupon_code="PRIMEIRACOMPRA", cpf="52998224725", email="outro-email@eco.com"))
check("PRIMEIRACOMPRA negado como visitante com o mesmo CPF", r.json().get("total") == 98.40, r.json().get("total"))
r = client.post("/api/payment/process-transparent-pix", headers=H_BOB, json=payload([item(P_SERUM, 1)], coupon_code="DEZ", cpf="11144477735", email="bob@eco.com"))
dez_oid, dez_pid = r.json()["order_id"], r.json()["payment_id"]
check("cupom DEZ aplicado (80 − 8 + 18,40 = 90,40)", abs(r.json()["total"] - 90.40) < 0.01, r.json().get("total"))
approve(dez_pid); webhook(dez_pid)
db.expire_all()
check("uso do cupom contado no pagamento", db.query(models.Coupon).filter_by(code="DEZ").first().usage_count == 1)
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 1)], coupon_code="DEZ"))
check("cupom com limite esgotado não é aplicado", abs(r.json()["total"] - 98.40) < 0.01, r.json().get("total"))

db.add(models.CashbackTransaction(user_id=ALICE.id, amount=30.0, type="earned", status="approved", description="teste"))
db.commit()
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 1)], cashback_amount=30))
cb_oid, cb_pid = r.json()["order_id"], r.json()["payment_id"]
check("cashback abatido (98,40 − 30 = 68,40)", abs(r.json()["total"] - 68.40) < 0.01, r.json().get("total"))
from app.api.endpoints.cashback import _available_balance  # noqa: E402
db.expire_all()
check("saldo ainda disponível enquanto o PIX não é pago", _available_balance(db, ALICE.id) >= 30.0, _available_balance(db, ALICE.id))
approve(cb_pid); webhook(cb_pid)
db.expire_all()
used_tx = db.query(models.CashbackTransaction).filter_by(order_id=cb_oid, type="used").first()
check("cashback debitado após o pagamento (transação 'used' de R$ 30)", used_tx is not None and used_tx.status == "used" and abs(used_tx.amount - 30) < 0.01)
bal = _available_balance(db, ALICE.id)
r = client.post("/api/payment/process-transparent-pix", headers=H_ALICE, json=payload([item(P_SERUM, 1)], cashback_amount=30))
applied = round(98.40 - r.json()["total"], 2)
check("nova compra só abate o saldo que sobrou (não reutiliza os R$ 30)", applied <= bal + 0.01 and applied < 30, f"abatido={applied} saldo={bal}")

print("\n▶ 10. Cartão de crédito")
t0 = time.time()
r = client.post("/api/payment/process-transparent-card", headers=H_ALICE,
                json={"order_data": payload([item(P_SOAP)]), "token": "tok_approve", "installments": 1, "payment_method_id": "visa"})
check("cartão aprovado → pedido pago", r.status_code == 200 and r.json()["status"] == "approved" and order(r.json()["order_id"]).status == "paid", r.text[:150])
r = client.post("/api/payment/process-transparent-card", headers=H_ALICE,
                json={"order_data": payload([item(P_SOAP)]), "token": "tok_reject", "installments": 1, "payment_method_id": "visa"})
check("cartão recusado → mensagem amigável e pedido pendente", r.status_code == 200 and r.json().get("detail") and order(r.json()["order_id"]).status == "pending", r.text[:150])

print("\n▶ 11. Pagamento combinado (PIX + cartão)")
r = client.post("/api/payment/split/init", headers=H_ALICE, json={"order_data": payload([item(P_SERUM, 1)]), "pix_amount": 40.0, "card_amount": 58.40})
check("combinado iniciado", r.status_code == 200, r.text[:150])
sp = r.json(); sp_oid = sp["order_id"]; sp_pix = sp["pix_slice"]["payment_id"]
approve(sp_pix); webhook(sp_pix)
check("PIX da parte 1 pago → parcialmente pago", order(sp_oid).status == "partially_paid", order(sp_oid).status)
r = client.post("/api/payment/split/process-card", headers=H_ALICE, json={"order_id": sp_oid, "token": "tok_approve", "installments": 1, "payment_method_id": "visa"})
check("cartão da parte 2 → pedido pago", r.status_code == 200 and order(sp_oid).status == "paid", r.text[:150])
r = client.post("/api/payment/split/process-card", headers=H_BOB, json={"order_id": sp_oid, "token": "tok_approve", "installments": 1, "payment_method_id": "visa"})
check("outro cliente não mexe no combinado alheio → 403", r.status_code == 403)

print("\n▶ 12. Checkout Pro (link Mercado Pago)")
r = client.post("/api/payment/create-mercadopago-checkout", json=payload([item(P_SERUM, 1), item(P_SOAP, 3)], coupon_code="", cpf="39053344705", email="visitante2@eco.com"))
check("link do Mercado Pago gerado (visitante)", r.status_code == 200 and r.json()["checkout_url"].startswith("https://mp/"), r.text[:150])
pref = MP["prefs"][r.json()["preference_id"]]
pref_total = round(sum(i["unit_price"] * i["quantity"] for i in pref["items"]), 2)
check("soma dos itens da preferência = total do pedido", abs(pref_total - order(r.json()["order_id"]).total) < 0.05, f"{pref_total} vs {order(r.json()['order_id']).total}")

print("\n▶ 13. Webhook Melhor Envio sem assinatura")
o = order(cheap_oid); o.shipment_id = "SHP-XYZ"; db.commit()
import app.services.melhorenvio_service as svc_me  # noqa: E402
svc_me.obter_detalhes_envio = lambda sid: {"status": "pending"}
r = client.post("/webhook/melhor-envio", json={"event": "order.cancelled", "data": {"id": "SHP-XYZ"}})
check("evento 'cancelado' forjado não cancela o pedido", r.status_code == 200 and order(cheap_oid).status == "paid", order(cheap_oid).status)
svc_me.obter_detalhes_envio = lambda sid: {"status": "posted", "tracking": "BR123"}
client.post("/webhook/melhor-envio", json={"event": "order.posted", "data": {"id": "SHP-XYZ"}})
check("status real consultado na API da Melhor Envio é aplicado (enviado + rastreio)", order(cheap_oid).status == "shipped" and order(cheap_oid).codigo_rastreio == "BR123", order(cheap_oid).status)

print("\n▶ 14. Admin / configurações")
r = client.post("/api/settings", json={"active_theme": "black_friday"})
check("salvar tema sem login → 401", r.status_code == 401)
r = client.post("/api/settings", headers=H_ALICE, json={"active_theme": "black_friday"})
check("salvar tema como cliente → 403", r.status_code == 403)
r = client.post("/api/settings", headers=H_ADMIN, json={"active_theme": "black_friday"})
check("salvar tema como admin → 200", r.status_code == 200, r.text[:100])
r = client.get("/api/shipping/test-connection")
check("diagnóstico da Melhor Envio não é mais público", r.status_code == 401)

ok = sum(1 for _, v in RESULTS if v)
print(f"\n══ {ok}/{len(RESULTS)} verificações passaram ══")
sys.exit(0 if ok == len(RESULTS) else 1)
