"""
Testes do backend do simulador "Personalize seu Produto".
Rodar:  cd backend && python tests/test_personalization.py
"""
import os
import sys
import tempfile

DB_FILE = os.path.join(tempfile.mkdtemp(), "personalization_test.db")
os.environ.update({"DATABASE_URL": f"sqlite:///{DB_FILE}", "SECRET_KEY": "test-secret", "FRONTEND_URL": "https://ecosopis.com.br"})
for k in ("POSTGRES_URL", "DATABASE_PUBLIC_URL"):
    os.environ.pop(k, None)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.database import SessionLocal, engine  # noqa: E402
from app.models import models  # noqa: E402
from app.core import security  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
client.__enter__()
db = SessionLocal()

OK = FAIL = 0


def check(name, cond, extra=""):
    global OK, FAIL
    if cond:
        OK += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name} {extra}")


def mk_user(email, role):
    u = models.User(email=email, full_name=email, role=role, is_verified=True, hashed_password=security.get_password_hash("x"))
    db.add(u); db.commit(); db.refresh(u)
    return {"Authorization": "Bearer " + security.create_access_token(str(u.id))}


H_ADMIN = mk_user("admin@eco.com", "admin")
H_CLIENT = mk_user("cli@eco.com", "client")

p1 = models.Product(name="Óleo Essencial Alecrim", slug="oleo-alecrim", description="10ml", price=30, stock=5, is_active=True,
                    category="Óleos", image_url="/api/images/1", images=["/api/images/1", "/api/images/2"], tags=[])
p2 = models.Product(name="Sem foto", slug="sem-foto", description="x", price=10, stock=5, is_active=True, tags=[], images=[])
p3 = models.Product(name="Inativo", slug="inativo", description="x", price=10, stock=5, is_active=False, image_url="/api/images/9", images=[], tags=[])
db.add_all([p1, p2, p3]); db.commit()
for p in (p1, p2, p3):
    db.refresh(p)

QUAD = [[0.3, 0.3], [0.7, 0.32], [0.7, 0.7], [0.3, 0.68]]
body = {"product_id": p1.id, "image_url": "/api/images/1", "name": "Rótulo", "quad": QUAD, "curvature": 0.4, "cover_label": True, "base_color": "#aabbcc"}

print("Catálogo público")
r = client.get("/api/personalization/products")
check("lista 200", r.status_code == 200, r.text[:100])
names = [p["name"] for p in r.json()]
check("traz produto com foto", "Óleo Essencial Alecrim" in names)
check("não traz produto sem foto nem inativo", "Sem foto" not in names and "Inativo" not in names)
first = r.json()[0]
check("sem configuração → área automática sugerida (já personalizável)", first["customizable"] is True and first["configured"] is False and first["areas"][0]["auto"] is True and first["areas"][0]["id"] < 0)
check("área automática do óleo é curva (frasco)", first["areas"][0]["curvature"] > 0)

print("Permissões")
check("criar sem login → 401", client.post("/api/personalization/areas", json=body).status_code in (401, 403))
check("criar como cliente → 403", client.post("/api/personalization/areas", json=body, headers=H_CLIENT).status_code == 403)

print("CRUD admin")
r = client.post("/api/personalization/areas", json=body, headers=H_ADMIN)
check("criar área → 201", r.status_code == 201, r.text[:200])
aid = r.json()["id"]
check("curvatura e cor salvas", r.json()["curvature"] == 0.4 and r.json()["base_color"] == "#aabbcc")
r = client.get("/api/personalization/products")
prod = r.json()[0]
check("catálogo marca produto como personalizável", prod["customizable"] is True and prod["configured"] is True and len([a for a in prod["areas"] if not a.get("auto")]) == 1)
check("área persistida com 4 cantos", len([a for a in prod["areas"] if not a.get("auto")][0]["quad"]) == 4)

r = client.put(f"/api/personalization/areas/{aid}", json={**body, "name": "Frente", "curvature": 0.9, "aspect_ratio": 2.5}, headers=H_ADMIN)
check("editar área → 200", r.status_code == 200 and r.json()["name"] == "Frente" and r.json()["aspect_ratio"] == 2.5, r.text[:200])

r2 = client.post("/api/personalization/areas", json={**body, "image_url": "/api/images/2", "name": "Verso"}, headers=H_ADMIN)
check("segunda área em outra foto do mesmo produto", r2.status_code == 201)
r3 = client.post("/api/personalization/areas", json={**body, "name": "Tampa"}, headers=H_ADMIN)
check("múltiplas áreas na mesma foto", r3.status_code == 201)
check("listagem admin traz 3 áreas", len(client.get(f"/api/personalization/areas?product_id={p1.id}", headers=H_ADMIN).json()) == 3)

print("Validações")
check("foto que não pertence ao produto → 400", client.post("/api/personalization/areas", json={**body, "image_url": "/api/images/777"}, headers=H_ADMIN).status_code == 400)
check("produto inexistente → 404", client.post("/api/personalization/areas", json={**body, "product_id": 99999}, headers=H_ADMIN).status_code == 404)
check("quad com 3 pontos → 422", client.post("/api/personalization/areas", json={**body, "quad": QUAD[:3]}, headers=H_ADMIN).status_code == 422)
check("quad fora da foto → 422", client.post("/api/personalization/areas", json={**body, "quad": [[0, 0], [2, 0], [2, 2], [0, 2]]}, headers=H_ADMIN).status_code == 422)
check("área minúscula → 422", client.post("/api/personalization/areas", json={**body, "quad": [[0.5, 0.5], [0.51, 0.5], [0.51, 0.51], [0.5, 0.51]]}, headers=H_ADMIN).status_code == 422)
check("cor inválida → 422", client.post("/api/personalization/areas", json={**body, "base_color": "vermelho"}, headers=H_ADMIN).status_code == 422)
check("proporção inválida → 422", client.post("/api/personalization/areas", json={**body, "aspect_ratio": 0}, headers=H_ADMIN).status_code == 422)
r = client.post("/api/personalization/areas", json={**body, "curvature": 7}, headers=H_ADMIN)
check("curvatura é limitada a 0..1", r.status_code == 201 and r.json()["curvature"] == 1.0)

print("Desativar / remover")
r = client.put(f"/api/personalization/areas/{aid}", json={**body, "is_active": False}, headers=H_ADMIN)
areas = client.get("/api/personalization/products").json()[0]["areas"]
check("área inativa some do catálogo público", aid not in [a["id"] for a in areas])
check("excluir como cliente → 403", client.delete(f"/api/personalization/areas/{aid}", headers=H_CLIENT).status_code == 403)
check("excluir área → 200", client.delete(f"/api/personalization/areas/{aid}", headers=H_ADMIN).status_code == 200)
check("excluir de novo → 404", client.delete(f"/api/personalization/areas/{aid}", headers=H_ADMIN).status_code == 404)

print("Itens só do simulador (sacola)")
bag = {"name": "Sacola kraft", "image_url": "/api/images/55"}
check("criar item como cliente → 403", client.post("/api/personalization/items", json=bag, headers=H_CLIENT).status_code == 403)
check("foto externa → 400", client.post("/api/personalization/items", json={**bag, "image_url": "http://x/y.png"}, headers=H_ADMIN).status_code == 400)
r = client.post("/api/personalization/items", json=bag, headers=H_ADMIN)
check("criar sacola → 201", r.status_code == 201, r.text[:150])
bid = r.json()["id"]
lst = client.get("/api/personalization/products").json()
b = [p for p in lst if p["id"] == bid]
check("sacola aparece no simulador como 'Embalagens', plana", len(b) == 1 and b[0]["category"] == "Embalagens" and b[0]["areas"][0]["curvature"] == 0 and b[0]["simulator_only"])
check("sacola não aparece na loja", bid not in [p["id"] for p in client.get("/api/products").json()])
check("excluir item como cliente → 403", client.delete(f"/api/personalization/items/{bid}", headers=H_CLIENT).status_code == 403)
check("excluir sacola → 200", client.delete(f"/api/personalization/items/{bid}", headers=H_ADMIN).status_code == 200)
check("produto comum não pode ser excluído por aqui → 404", client.delete(f"/api/personalization/items/{p1.id}", headers=H_ADMIN).status_code == 404)

print(f"\n{OK} ok, {FAIL} falhas")
sys.exit(1 if FAIL else 0)
