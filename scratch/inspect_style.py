import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('<style')
idx_end = text.find('</style>')
print(text[idx:idx+1500])
