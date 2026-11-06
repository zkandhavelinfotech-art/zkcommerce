import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

pos = 133385
print(text[pos-40:pos+2500])

