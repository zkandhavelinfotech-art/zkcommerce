import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function loadProducts')
if idx == -1:
    idx = text.find('loadProducts')
print(text[idx-50:idx+2000])

