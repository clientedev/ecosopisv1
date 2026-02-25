import requests
import json

BASE_URL = "http://localhost:8000" # Test backend directly first

def test_full_flow():
    email = "flow_test@example.com"
    password = "Password123"
    
    print(f"1. Testing Register at {BASE_URL}/auth/register")
    reg_data = {
        "email": email,
        "password": password,
        "full_name": "Flow Test User"
    }
    res = requests.post(f"{BASE_URL}/auth/register", json=reg_data)
    print(f"Register status: {res.status_code}")
    if res.status_code != 200:
        print(f"Register failed: {res.text}")
        # If it already exists, just continue
        if "already registered" not in res.text:
            return

    print(f"\n2. Testing Login at {BASE_URL}/auth/login")
    login_data = {
        "username": email,
        "password": password
    }
    res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    print(f"Login status: {res.status_code}")
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        return
    
    token = res.json()["access_token"]
    print(f"Token received: {token[:20]}...")

    print(f"\n3. Testing /me at {BASE_URL}/auth/me")
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"Me status: {res.status_code}")
    if res.status_code == 200:
        print(f"User data: {res.json()['email']} | Pode girar: {res.json().get('pode_girar_roleta')}")
    else:
        print(f"Me failed: {res.text}")

    print(f"\n4. Testing Roulette /prizes")
    res = requests.get(f"{BASE_URL}/roleta/prizes")
    print(f"Prizes status: {res.status_code}")
    if res.status_code == 200:
        prizes = res.json()
        print(f"Prizes count: {len(prizes)}")
        for p in prizes:
            print(f" - {p['nome']} (Ativo: {p['ativo']})")

if __name__ == "__main__":
    test_full_flow()
