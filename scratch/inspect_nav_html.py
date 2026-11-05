import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('<nav')
idx_end = text.find('</nav>')
print(text[idx:idx_end+10])
