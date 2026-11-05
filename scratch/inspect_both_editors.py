import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. Inspect products.html modals
with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text_p = f.read()

m1 = text_p.find('id="editProductModal"')
m2 = text_p.find('id="editProductModal"', m1 + 1)
print(f'products.html: First modal at pos {m1}, Second modal at pos {m2}')
if m2 != -1:
    script_pos = text_p.find('<script', m2)
    print(f'Second modal ends before script at pos {script_pos}')
    print('Snippet before script in products.html:')
    print(text_p[script_pos-150:script_pos])

# 2. Inspect store-builder/index.html for product edit
with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text_sb = f.read()

print('\nstore-builder/index.html search:')
sb_edit = text_sb.find('editProduct')
print('editProduct in store-builder pos:', sb_edit)
if sb_edit != -1:
    print('Snippet around editProduct:')
    print(text_sb[sb_edit-100:sb_edit+300])

sb_modal = text_sb.find('modal')
print('\nModals in store-builder:')
for line in text_sb.splitlines():
    if 'id=' in line and 'modal' in line.lower():
        print('  ', line.strip())
