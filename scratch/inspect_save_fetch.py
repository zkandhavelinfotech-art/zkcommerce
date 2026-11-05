import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('saveProductFromModal')
print(text[idx+2500:idx+4500])
