import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('/* Sidebar */')
idx_end = text.find('/* Main Area */', idx)
print(text[idx:idx_end])

