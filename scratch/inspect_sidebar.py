import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('<aside class="sidebar')
if idx == -1:
    idx = text.find('sidebar')
print(text[idx-50:idx+2500])
