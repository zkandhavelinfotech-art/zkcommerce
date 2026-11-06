import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="productModal"')
print(text[idx-50:idx+1500])

