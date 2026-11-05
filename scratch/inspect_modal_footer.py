import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('.modal-footer')
print(text[idx-50:idx+600])
