import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'productForm', text)]
print('productForm found at positions:', matches)
for pos in matches:
    print('--- AT', pos, '---')
    print(text[max(0, pos-40):pos+120])
