import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'saveProductFromModal', text):
    pos = m.start()
    print('--- AT', pos, '---')
    print(text[max(0, pos-40):pos+120])

