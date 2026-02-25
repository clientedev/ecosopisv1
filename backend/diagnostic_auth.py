import urllib.request
import urllib.parse
import json
import random
import string

def random_email():
    return ''.join(random.choices(string.ascii_lowercase, k=10)) + "@test.com"

def test_register():
    email = random_email()
    print(f"Testing registration with {email}...")
    data = json.dumps({
        "email": email,
        "password": "testpassword123",
        "full_name": "Test User From Script"
    }).encode('utf-8')
    
    req = urllib.request.Request(
        "http://localhost:8000/auth/register", 
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as f:
            print("Register Success:", f.read().decode())
            return email
    except urllib.error.HTTPError as e:
        print("Register HTTP Error:", e.code)
        print("Body:", e.read().decode())
    except Exception as e:
        print("Register Error:", str(e))
    return None

def test_login(email):
    print(f"Testing login with {email}...")
    # OAuth2PasswordRequestForm expects form data
    data = urllib.parse.urlencode({
        "username": email,
        "password": "testpassword123"
    }).encode('utf-8')
    
    req = urllib.request.Request(
        "http://localhost:8000/auth/login", 
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    try:
        with urllib.request.urlopen(req) as f:
            print("Login Success:", f.read().decode())
    except urllib.error.HTTPError as e:
        print("Login HTTP Error:", e.code)
        print("Body:", e.read().decode())
    except Exception as e:
        print("Login Error:", str(e))

if __name__ == "__main__":
    email = test_register()
    if email:
        test_login(email)
