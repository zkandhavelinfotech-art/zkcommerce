import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'nav[A-Za-z0-9_-]*|\.nav[A-Za-z0-9_-]*', text):
    word = m.group(0)
    if word not in ['nav', 'nav-item', 'nav-icon', 'nav-group-label']:
        print(word, 'at pos', m.start())

