import re

api_path = 'zkc/api/services/php/api.php'

with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update zkcGetProducts fallback list
old_fallback = """    return [
        ['id' => 1, 'store_id' => $storeId, 'category_id' => 1, 'category_name' => 'Hair Care', 'name' => 'Classical Siddha Hair Oil', 'slug' => 'siddha-hair-oil', 'price' => 299.00, 'gst_rate' => 5.0, 'hsn_code' => '33059019', 'in_stock' => true, 'active' => true],
        ['id' => 2, 'store_id' => $storeId, 'category_id' => 2, 'category_name' => 'Joint Care', 'name' => 'Ortho Pain Relief Thailam', 'slug' => 'ortho-pain-oil', 'price' => 349.00, 'gst_rate' => 5.0, 'hsn_code' => '30049013', 'in_stock' => true, 'active' => true],
        ['id' => 3, 'store_id' => $storeId, 'category_id' => 3, 'category_name' => 'Ayurgold Face Care', 'name' => 'Ayurgold Kumkumadi Face Glow Oil', 'slug' => 'ayurgold-face-oil', 'price' => 499.00, 'gst_rate' => 18.0, 'hsn_code' => '33049990', 'in_stock' => true, 'active' => true],
        ['id' => 4, 'store_id' => $storeId, 'category_id' => 4, 'category_name' => 'Vedic Health Foods', 'name' => 'Vedic A2 Desi Gir Cow Ghee', 'slug' => 'vedic-health-mix', 'price' => 799.00, 'gst_rate' => 18.0, 'hsn_code' => '19011099', 'in_stock' => true, 'active' => true]
    ];"""

new_fallback = """    return [
        ['id' => 1, 'store_id' => $storeId, 'category_id' => 2, 'category_name' => 'Joint Care', 'name' => 'Smeram Ortho Pain Relief Thailam', 'sku' => 'SM-PO-100', 'slug' => 'ortho-pain-oil', 'price' => 349.00, 'mrp' => 499.00, 'gst_rate' => 5.0, 'hsn_code' => '30049013', 'quantity' => 120, 'stock' => 120, 'in_stock' => true, 'active' => true],
        ['id' => 2, 'store_id' => $storeId, 'category_id' => 1, 'category_name' => 'Hair Care', 'name' => 'Smeram Naturals Siddha Hair Oil', 'sku' => 'SM-HO-200', 'slug' => 'siddha-hair-oil', 'price' => 299.00, 'mrp' => 449.00, 'gst_rate' => 5.0, 'hsn_code' => '33059019', 'quantity' => 85, 'stock' => 85, 'in_stock' => true, 'active' => true],
        ['id' => 3, 'store_id' => $storeId, 'category_id' => 3, 'category_name' => 'Skin Care', 'name' => 'Smeram Ayurgold Kumkumadi Face Glow Oil', 'sku' => 'SM-FP-050', 'slug' => 'ayurgold-face-oil', 'price' => 499.00, 'mrp' => 699.00, 'gst_rate' => 18.0, 'hsn_code' => '33049990', 'quantity' => 65, 'stock' => 65, 'in_stock' => true, 'active' => true],
        ['id' => 4, 'store_id' => $storeId, 'category_id' => 4, 'category_name' => 'Vedic Health Foods', 'name' => 'Smeram Vedic Multi-Grain Health Mix & Desi Ghee', 'sku' => 'SM-HM-500', 'slug' => 'vedic-health-mix', 'price' => 799.00, 'mrp' => 999.00, 'gst_rate' => 18.0, 'hsn_code' => '19011099', 'quantity' => 50, 'stock' => 50, 'in_stock' => true, 'active' => true]
    ];"""

if old_fallback in content:
    content = content.replace(old_fallback, new_fallback)
    print("Updated zkcGetProducts fallback")

# 2. Add products CRUD route
target_anchor = "// Display settings"
products_crud = """// ── Products CRUD & Inclusive GST Calculations ───────────────────
if (($route === 'products' || preg_match('#^stores/(\\\\d+)/products$#', $route)) && $method === 'GET') {
    $storeId = STORE_ID;
    if (isset($_GET['store_id'])) $storeId = (int)$_GET['store_id'];
    elseif (preg_match('#^stores/(\\\\d+)/products$#', $route, $pm)) $storeId = (int)$pm[1];

    $products = zkcGetProducts($pdo, $storeId);
    foreach ($products as &$p) {
        $rate = (float)($p['gst_rate'] ?? 5.0);
        $price = (float)($p['price'] ?? 0);
        $taxable = round($price * 100.0 / (100.0 + $rate), 2);
        $gstAmt = round($price - $taxable, 2);
        $p['taxable_value'] = $taxable;
        $p['gst_amount'] = $gstAmt;
        $p['cgst_amount'] = round($gstAmt / 2.0, 2);
        $p['sgst_amount'] = round($gstAmt - round($gstAmt / 2.0, 2), 2);
        if (empty($p['hsn_code'])) {
            $p['hsn_code'] = ($rate == 5.0 ? '30049013' : '33049990');
        }
        $p['stock'] = (int)($p['quantity'] ?? ($p['stock'] ?? 100));
    }
    respond(['products' => $products, 'total' => count($products)]);
}

if (preg_match('#^products/(\\\\d+)$#', $route, $pm) && $method === 'GET') {
    $prodId = (int)$pm[1];
    $products = zkcGetProducts($pdo);
    $found = null;
    foreach ($products as $p) {
        if ((int)$p['id'] === $prodId) { $found = $p; break; }
    }
    if (!$found) respond(['error' => 'Product not found'], 404);
    $rate = (float)($found['gst_rate'] ?? 5.0);
    $price = (float)($found['price'] ?? 0);
    $taxable = round($price * 100.0 / (100.0 + $rate), 2);
    $gstAmt = round($price - $taxable, 2);
    $found['taxable_value'] = $taxable;
    $found['gst_amount'] = $gstAmt;
    $found['cgst_amount'] = round($gstAmt / 2.0, 2);
    $found['sgst_amount'] = round($gstAmt - round($gstAmt / 2.0, 2), 2);
    respond(['product' => $found]);
}

if (preg_match('#^products/(\\\\d+)$#', $route, $pm) && ($method === 'PUT' || $method === 'POST')) {
    $prodId = (int)$pm[1];
    $name = trim((string)($body['name'] ?? ''));
    $price = isset($body['price']) ? (float)$body['price'] : 0.0;
    $mrp = isset($body['mrp']) ? (float)$body['mrp'] : null;
    $stock = isset($body['stock']) ? (int)$body['stock'] : (isset($body['quantity']) ? (int)$body['quantity'] : 100);
    $gstRate = isset($body['gst_rate']) ? (float)$body['gst_rate'] : 5.0;
    $hsnCode = trim((string)($body['hsn_code'] ?? ''));
    if ($hsnCode === '') {
        $hsnCode = ($gstRate == 5.0) ? '30049013' : '33049990';
    }
    $desc = trim((string)($body['description'] ?? ''));
    $status = trim((string)($body['status'] ?? 'published'));
    $active = ($status === 'published' || $status === 'active') ? 1 : 0;

    if ($pdo) {
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `products`")->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!in_array('gst_rate', $cols)) {
                try { $pdo->exec("ALTER TABLE `products` ADD COLUMN `gst_rate` DECIMAL(5,2) DEFAULT 5.00"); } catch(Exception $e){}
            }
            if (!in_array('hsn_code', $cols)) {
                try { $pdo->exec("ALTER TABLE `products` ADD COLUMN `hsn_code` VARCHAR(20) DEFAULT '30049013'"); } catch(Exception $e){}
            }
            $stmt = $pdo->prepare("UPDATE `products` SET name = COALESCE(NULLIF(?, ''), name), price = ?, quantity = ?, gst_rate = ?, hsn_code = ?, active = ? WHERE id = ?");
            $stmt->execute([$name, $price, $stock, $gstRate, $hsnCode, $active, $prodId]);
        } catch (Exception $e) {}
    }

    $taxable = round($price * 100.0 / (100.0 + $gstRate), 2);
    $gstAmt = round($price - $taxable, 2);

    respond([
        'success' => true,
        'product' => [
            'id' => $prodId,
            'name' => $name,
            'price' => $price,
            'mrp' => $mrp,
            'stock' => $stock,
            'quantity' => $stock,
            'gst_rate' => $gstRate,
            'hsn_code' => $hsnCode,
            'taxable_value' => $taxable,
            'gst_amount' => $gstAmt,
            'cgst_amount' => round($gstAmt / 2.0, 2),
            'sgst_amount' => round($gstAmt - round($gstAmt / 2.0, 2), 2),
            'status' => $status
        ]
    ]);
}

"""

if "route === 'products'" not in content:
    content = content.replace(target_anchor, products_crud + target_anchor)
    print("Added products CRUD routes to api.php")

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("api.php updated successfully!")

