import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('view-products')
if idx != -1:
    print('view-products found at:', idx)
    print(text[idx-50:idx+800])
else:
    print('view-products not found')

