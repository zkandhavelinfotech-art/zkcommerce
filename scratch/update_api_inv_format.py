with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

# 1. Update zkcGetProducts with gst_rate and hsn_code
old_prods = """    return [
        ['id' => 1, 'store_id' => $storeId, 'category_id' => 1, 'category_name' => 'Hair Care', 'name' => 'Classical Siddha Hair Oil', 'slug' => 'siddha-hair-oil', 'price' => 399.00, 'in_stock' => true, 'active' => true],
        ['id' => 2, 'store_id' => $storeId, 'category_id' => 2, 'category_name' => 'Joint Care', 'name' => 'Ortho Pain Relief Thailam', 'slug' => 'ortho-pain-oil', 'price' => 449.00, 'in_stock' => true, 'active' => true],
        ['id' => 3, 'store_id' => $storeId, 'category_id' => 3, 'category_name' => 'Ayurgold Face Care', 'name' => 'Ayurgold Kumkumadi Face Glow Oil', 'slug' => 'ayurgold-face-oil', 'price' => 599.00, 'in_stock' => true, 'active' => true],
        ['id' => 4, 'store_id' => $storeId, 'category_id' => 4, 'category_name' => 'Vedic Health Foods', 'name' => 'Pure Moringa Leaf Powder', 'slug' => 'moringa-powder', 'price' => 249.00, 'in_stock' => true, 'active' => true]
    ];"""

new_prods = """    return [
        ['id' => 1, 'store_id' => $storeId, 'category_id' => 1, 'category_name' => 'Hair Care', 'name' => 'Classical Siddha Hair Oil', 'slug' => 'siddha-hair-oil', 'price' => 299.00, 'gst_rate' => 5.0, 'hsn_code' => '33059019', 'in_stock' => true, 'active' => true],
        ['id' => 2, 'store_id' => $storeId, 'category_id' => 2, 'category_name' => 'Joint Care', 'name' => 'Ortho Pain Relief Thailam', 'slug' => 'ortho-pain-oil', 'price' => 349.00, 'gst_rate' => 5.0, 'hsn_code' => '30049013', 'in_stock' => true, 'active' => true],
        ['id' => 3, 'store_id' => $storeId, 'category_id' => 3, 'category_name' => 'Ayurgold Face Care', 'name' => 'Ayurgold Kumkumadi Face Glow Oil', 'slug' => 'ayurgold-face-oil', 'price' => 499.00, 'gst_rate' => 18.0, 'hsn_code' => '33049990', 'in_stock' => true, 'active' => true],
        ['id' => 4, 'store_id' => $storeId, 'category_id' => 4, 'category_name' => 'Vedic Health Foods', 'name' => 'Vedic A2 Desi Gir Cow Ghee', 'slug' => 'vedic-health-mix', 'price' => 799.00, 'gst_rate' => 18.0, 'hsn_code' => '19011099', 'in_stock' => true, 'active' => true]
    ];"""

if old_prods in code:
    code = code.replace(old_prods, new_prods, 1)
    print("1. zkcGetProducts updated with GST rates and HSN codes.")
else:
    print("WARNING: old_prods not found.")

# 2. Update invoice_number generation in invoices endpoints
old_inv_query = "CONCAT('ZK-2-', id) AS invoice_number FROM `{$tbl}` {$sqlWhere} ORDER BY id DESC LIMIT 100"
new_inv_query = "CONCAT('SM-', LPAD(id, 2, '0')) AS invoice_number FROM `{$tbl}` {$sqlWhere} ORDER BY id DESC LIMIT 100"

if old_inv_query in code:
    code = code.replace(old_inv_query, new_inv_query, 1)
    print("2. Invoices query updated to SM-XX format.")
else:
    print("WARNING: old_inv_query not found.")

code = code.replace("$invNum = 'ZK-' . (defined('STORE_ID') ? STORE_ID : 2) . '-' . $orderId;", "$invNum = 'SM-' . sprintf('%02d', $orderId);")

with open('zkc/api/services/php/api.php', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: api.php updated!")

