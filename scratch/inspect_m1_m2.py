import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Check where the second modal starts and ends
m1 = text.find('id="editProductModal"')
m2 = text.find('id="editProductModal"', m1 + 10)
script_idx = text.find('<script', m2)

print('First modal pos:', m1)
print('Second modal pos:', m2)
print('Script pos:', script_idx)

# Check the closing of the first modal before second modal
m1_close = text.rfind('</div>', 0, m2)
print('m1_close:', m1_close)
print('Between m1_close and m2:')
print(repr(text[m1_close-50:m2]))
