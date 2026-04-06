import time
import requests

print("Polling remote diagnostic endpoint...")
while True:
    try:
        res = requests.get("https://www.ecosopis.com.br/api/diagnostic")
        if res.status_code == 200:
            print("SUCCESS! Body:")
            print(res.text)
            break
        print(f"Got {res.status_code}, polling again in 15s...")
    except Exception as e:
        print(f"Exception: {e}")
    time.sleep(15)
