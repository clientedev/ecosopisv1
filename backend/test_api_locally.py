from fastapi.testclient import TestClient
from app.main import app
import traceback

def test():
    try:
        client = TestClient(app)
        res = client.get("/products")
        print("Products Status:", res.status_code)
        print("Products Body Snapshot:", res.text[:500])
        
        res2 = client.post("/auth/login", data={"username": "test@test.com", "password": "abc"})
        print("Login Status:", res2.status_code)
        if res2.status_code == 500:
            print("Login 500:", res2.text)
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    test()
