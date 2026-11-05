import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="productModal"')
idx_end = text.find('id="categoryModal"', idx)
print(text[idx_end-600:idx_end])
