import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import models

client = TestClient(app)

def test_routes():
    print("Testing existing routes...")
    # Test root
    resp = client.get("/")
    assert resp.status_code == 200
    print("[OK] Root endpoint OK:", resp.json())

    # Test diagnostic
    resp = client.get("/diagnostic")
    assert resp.status_code == 200
    print("[OK] Diagnostic endpoint OK")

    # Test google login when client_id is not set
    os.environ["GOOGLE_CLIENT_ID"] = ""
    resp = client.get("/auth/google/login", follow_redirects=False)
    assert resp.status_code == 302
    assert "error=google_not_configured" in resp.headers["location"]
    print("[OK] Google login handles unconfigured client ID gracefully:", resp.headers["location"])

    # Test google login when client_id is set
    os.environ["GOOGLE_CLIENT_ID"] = "test-client-id-12345.apps.googleusercontent.com"
    os.environ["GOOGLE_REDIRECT_URI"] = "https://ecosopis.com.br/api/auth/google/callback"
    resp = client.get("/auth/google/login?redirect=/carrinho", follow_redirects=False)
    assert resp.status_code == 302
    loc = resp.headers["location"]
    assert "accounts.google.com" in loc
    assert "client_id=test-client-id-12345.apps.googleusercontent.com" in loc
    assert "redirect_uri=https%3A%2F%2Fecosopis.com.br%2Fapi%2Fauth%2Fgoogle%2Fcallback" in loc
    assert "state=" in loc
    print("[OK] Google login generates exact OAuth URL correctly:", loc[:120] + "...")

    # Test google callback with error (e.g. user cancelled)
    resp = client.get("/auth/google/callback?error=access_denied", follow_redirects=False)
    assert resp.status_code == 302
    assert "error=google_cancelled" in resp.headers["location"]
    print("[OK] Google callback handles cancellation correctly:", resp.headers["location"])

    # Test google callback without code
    resp = client.get("/auth/google/callback", follow_redirects=False)
    assert resp.status_code == 302
    assert "error=google_error" in resp.headers["location"]
    print("[OK] Google callback handles missing code correctly:", resp.headers["location"])

    # Test full callback flow with mocked Google APIs
    from unittest.mock import patch, MagicMock
    from app.core import security

    db = SessionLocal()
    try:
        # Clean up any test users
        db.query(models.User).filter(models.User.email.in_(["newuser_google@test.com", "existing_google@test.com"])).delete(synchronize_session=False)
        db.commit()

        # 1. Pre-create an existing user with normal password
        pwd_hash = security.get_password_hash("MinhaSenha123!")
        existing = models.User(
            email="existing_google@test.com",
            hashed_password=pwd_hash,
            full_name="Usuario Existente",
            role="client",
            is_verified=False,
            total_compras=5,
            can_post_news=True,
            phone="(11) 98888-7777"
        )
        db.add(existing)
        db.commit()
        db.refresh(existing)
        existing_id = existing.id

        # Generate a valid state token
        from jose import jwt
        from datetime import datetime, timezone, timedelta
        import secrets

        state_payload = {
            "redirect": "/perfil",
            "origin": "https://ecosopis.com.br",
            "nonce": secrets.token_urlsafe(16),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
        }
        valid_state = jwt.encode(state_payload, security.SECRET_KEY, algorithm=security.ALGORITHM)

        os.environ["GOOGLE_CLIENT_ID"] = "mock_client_id"
        os.environ["GOOGLE_CLIENT_SECRET"] = "mock_client_secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "https://ecosopis.com.br/api/auth/google/callback"

        # Mock httpx.AsyncClient.post and get
        class MockResponse:
            def __init__(self, status_code, json_data):
                self.status_code = status_code
                self._json = json_data
                self.text = str(json_data)
            def json(self):
                return self._json

        # Test Case A: Existing user logs in via Google
        async def mock_post(url, *args, **kwargs):
            return MockResponse(200, {"access_token": "mock_google_token_123", "token_type": "Bearer"})

        async def mock_get_existing(url, *args, **kwargs):
            return MockResponse(200, {
                "sub": "google_sub_existing_999",
                "email": "existing_google@test.com",
                "email_verified": True,
                "name": "Nome No Google",
                "picture": "https://lh3.googleusercontent.com/pic1"
            })

        with patch("httpx.AsyncClient.post", new=mock_post), patch("httpx.AsyncClient.get", new=mock_get_existing):
            resp = client.get(f"/auth/google/callback?code=mock_code_1&state={valid_state}", follow_redirects=False)
            assert resp.status_code == 200
            assert "Autenticado com sucesso!" in resp.text
            print("[OK] Existing user callback returns success HTML")

            # Check DB: existing user has NOT had their role, permissions, purchases or password altered!
            db.expire_all()
            u = db.query(models.User).filter(models.User.email == "existing_google@test.com").first()
            assert u.id == existing_id
            assert u.google_id == "google_sub_existing_999"
            assert u.is_verified == True
            assert u.role == "client"
            assert u.total_compras == 5
            assert u.can_post_news == True
            assert u.phone == "(11) 98888-7777"
            print("[OK] Existing user data, role, permissions, and orders 100% PRESERVED!")

            # Verify traditional login still works with their password!
            login_resp = client.post("/auth/login", data={"username": "existing_google@test.com", "password": "MinhaSenha123!"})
            assert login_resp.status_code == 200
            assert "access_token" in login_resp.json()
            print("[OK] Existing user can STILL log in with regular password!")

        # Test Case B: New user signs up via Google
        async def mock_get_new(url, *args, **kwargs):
            return MockResponse(200, {
                "sub": "google_sub_new_888",
                "email": "newuser_google@test.com",
                "email_verified": True,
                "name": "Novo Usuario Google",
                "picture": "https://lh3.googleusercontent.com/pic2"
            })

        with patch("httpx.AsyncClient.post", new=mock_post), patch("httpx.AsyncClient.get", new=mock_get_new):
            resp = client.get(f"/auth/google/callback?code=mock_code_2&state={valid_state}", follow_redirects=False)
            assert resp.status_code == 200
            assert "Autenticado com sucesso!" in resp.text
            print("[OK] New user callback returns success HTML")

            # Check DB: new user created with client role, verified, google_id and auth_provider
            db.expire_all()
            new_u = db.query(models.User).filter(models.User.email == "newuser_google@test.com").first()
            assert new_u is not None
            assert new_u.google_id == "google_sub_new_888"
            assert new_u.auth_provider == "google"
            assert new_u.role == "client"
            assert new_u.is_verified == True
            assert new_u.full_name == "Novo Usuario Google"
            assert new_u.profile_picture == "https://lh3.googleusercontent.com/pic2"
            print("[OK] New user auto-created with correct client defaults and verified status!")

        # Test Case C: Verify normal registration still works
        with patch("app.core.emails.send_verification_email") as mock_email:
            reg_resp = client.post("/auth/register", json={
                "email": "test_normal_reg@test.com",
                "password": "SenhaSegura123!",
                "full_name": "Registro Normal",
                "phone": "(11) 97777-6666"
            })
            assert reg_resp.status_code == 200
            reg_data = reg_resp.json()
            assert reg_data["email"] == "test_normal_reg@test.com"
            assert reg_data["role"] == "client"
            print("[OK] Regular registration endpoint still works 100%!")

    finally:
        # Cleanup test records
        db.query(models.User).filter(models.User.email.in_(["newuser_google@test.com", "existing_google@test.com", "test_normal_reg@test.com"])).delete(synchronize_session=False)
        db.commit()
        db.close()

    print("\nALL BACKEND GOOGLE AUTH & LEGACY COMPATIBILITY TESTS PASSED 100%!")

if __name__ == "__main__":
    test_routes()

