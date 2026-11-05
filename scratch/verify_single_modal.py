with open('zkc/merchant/products.html', 'r', encoding='utf-8') as f:
    text = f.read()

count = text.count('id="editProductModal"')
print('Count of editProductModal IDs:', count)
assert count == 1, f"Expected 1, got {count}"
print("VERIFICATION PASSED!")
