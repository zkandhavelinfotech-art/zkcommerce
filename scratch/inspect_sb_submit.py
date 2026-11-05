import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("getElementById('productForm').onsubmit")
if idx == -1:
    idx = text.find('productForm')
print(text[idx:idx+2500])
