import urllib.request
import re

req = urllib.request.Request('https://www.ecosopis.com.br/carrinho', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as r:
        html = r.read().decode('utf-8', errors='ignore')
        print('Page length:', len(html))
        scripts = re.findall(r'src="([^"]+\.js)"', html)
        print('Scripts count:', len(scripts))
        for s in scripts:
            js_url = s if s.startswith('http') else 'https://www.ecosopis.com.br' + s
            try:
                js_content = urllib.request.urlopen(urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8', errors='ignore')
                has_debit = 'debit_card' in js_content
                has_public_cfg = 'public-config' in js_content
                if has_debit or has_public_cfg:
                    print(f'{s}: has_debit={has_debit}, has_public_cfg={has_public_cfg}')
            except Exception as ex:
                pass
except Exception as e:
    print('Error:', e)
