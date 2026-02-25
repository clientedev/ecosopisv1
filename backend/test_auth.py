import urllib.request
import urllib.parse
import json

data = urllib.parse.urlencode({"username": "admin@ecosopis.com.br", "password": "admin123"}).encode()
req = urllib.request.Request("http://localhost:8000/auth/login", data=data)
try:
    with urllib.request.urlopen(req) as f:
        print("Success:", f.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Body:", e.read().decode())
except Exception as e:
    print("Error:", str(e))
