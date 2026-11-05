import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

pos = 68665 + 2300
print(text[pos:pos+2500])
