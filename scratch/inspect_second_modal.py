import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

m1 = text.find('id="editProductModal"')
m2 = text.find('id="editProductModal"', m1 + 10)
script_idx = text.find('<script', m2)

print('First modal pos:', m1)
print('Second modal pos:', m2)
print('Script pos:', script_idx)
print('\n--- Second modal preview (first 500 chars) ---')
print(text[m2:m2+500])
print('\n--- Second modal preview (last 500 chars) ---')
print(text[script_idx-500:script_idx])
