import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function saveProductFromModal')
print(text[idx+1200:idx+3500])
