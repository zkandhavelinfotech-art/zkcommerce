import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'preview_additional_note_badge', text):
    pos = m.start()
    print('--- AT', pos, '---')
    print(text[max(0, pos-40):pos+80])
