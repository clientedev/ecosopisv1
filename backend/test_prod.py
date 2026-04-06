import requests

try:
    res = requests.get("https://www.ecosopis.com.br/api/products")
    print(f"Status Code: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(f"Successfully fetched {len(data)} products from Production!")
        print(f"Sample product format: {str(data[0])[:150]}")
    else:
        print(f"Error fetching products: {res.text[:200]}")
except Exception as e:
    print(f"Exception: {e}")
