path = 'zkc/api/services/php/api.php'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Update zkcGetProducts fallback with full fields
old_prod_fallback = """    return [
        ['id' => 1, 'store_id' => $storeId, 'category_id' => 2, 'category_name' => 'Joint Care', 'name' => 'Smeram Ortho Pain Relief Thailam', 'sku' => 'SM-PO-100', 'slug' => 'ortho-pain-oil', 'price' => 349.00, 'mrp' => 499.00, 'gst_rate' => 5.0, 'hsn_code' => '30049013', 'quantity' => 120, 'stock' => 120, 'in_stock' => true, 'active' => true],
        ['id' => 2, 'store_id' => $storeId, 'category_id' => 1, 'category_name' => 'Hair Care', 'name' => 'Smeram Naturals Siddha Hair Oil', 'sku' => 'SM-HO-200', 'slug' => 'siddha-hair-oil', 'price' => 299.00, 'mrp' => 449.00, 'gst_rate' => 5.0, 'hsn_code' => '33059019', 'quantity' => 85, 'stock' => 85, 'in_stock' => true, 'active' => true],
        ['id' => 3, 'store_id' => $storeId, 'category_id' => 3, 'category_name' => 'Skin Care', 'name' => 'Smeram Ayurgold Kumkumadi Face Glow Oil', 'sku' => 'SM-FP-050', 'slug' => 'ayurgold-face-oil', 'price' => 499.00, 'mrp' => 699.00, 'gst_rate' => 18.0, 'hsn_code' => '33049990', 'quantity' => 65, 'stock' => 65, 'in_stock' => true, 'active' => true],
        ['id' => 4, 'store_id' => $storeId, 'category_id' => 4, 'category_name' => 'Vedic Health Foods', 'name' => 'Smeram Vedic Multi-Grain Health Mix & Desi Ghee', 'sku' => 'SM-HM-500', 'slug' => 'vedic-health-mix', 'price' => 799.00, 'mrp' => 999.00, 'gst_rate' => 18.0, 'hsn_code' => '19011099', 'quantity' => 50, 'stock' => 50, 'in_stock' => true, 'active' => true]
    ];"""

new_prod_fallback = """    $defaults = [
        [
            'id' => 1, 'store_id' => $storeId, 'category_id' => 2, 'category_name' => 'Joint Care & Pain Relief',
            'name' => 'Smeram Siddha Ortho Pain Relief Thailam (Joint Care)', 'sku' => 'SM-PO-100', 'slug' => 'ortho-pain-oil',
            'price' => 349.00, 'mrp' => 499.00, 'compare_price' => 499.00, 'gst_rate' => 5.0, 'hsn_code' => '30049013',
            'quantity' => 120, 'stock' => 120, 'product_size' => '100 ml', 'net_quantity_value' => 100, 'net_quantity_unit' => 'ml',
            'low_stock_threshold' => 20, 'in_stock' => true, 'active' => true, 'brand' => 'Smeram Naturals',
            'badge_text' => 'Classical Siddha Tailam · 24 Medicinal Herbs', 'offer_text' => 'Festive Launch Offer - Save ₹150', 'show_offer' => 'show',
            'description' => "- Classical Siddha Formulation for Joint & Muscle Pain\\n- Rapid Deep Tissue Penetration & Warming Relief\\n- Clinically Proven to Alleviate Stiffness & Spasms\\n- 100% Herbal, Non-Greasy & Fast Absorbing\\n\\nTraditional Siddha herbal pain relief thailam formulated with 24 potent anti-inflammatory botanicals, Mahanarayan thailam, wintergreen, and camphor.",
            'ingredients' => 'Mahanarayan Thailam, Wintergreen Oil, Camphor, Nilgiri (Eucalyptus), Pudina Satva, Gandhapura, Til Oil (Sesame)',
            'user_instructions' => 'Apply 5-10 ml gently over affected joints or muscles. Massage in circular motions for 5 minutes. Apply a warm compress for enhanced relief. Use 2-3 times daily.',
            'benefits' => "• Instant cooling sensation followed by deep warming relief\\n• Clinically proven to reduce joint stiffness and inflammation\\n• 100% Classical Siddha herbal formulation (HSN 30049013 - 5% GST)",
            'additional_note' => 'Inclusive of 5% GST and free shipping.',
            'variants' => [
                ['id' => 'v1', 'label' => '100 ml', 'size_value' => 100, 'size_unit' => 'ml', 'price' => 349, 'compare_price' => 499, 'sku' => 'SM-PO-100', 'quantity' => 70],
                ['id' => 'v2', 'label' => '200 ml', 'size_value' => 200, 'size_unit' => 'ml', 'price' => 599, 'compare_price' => 899, 'sku' => 'SM-PO-200', 'quantity' => 50]
            ],
            'images' => ['/assets/themes/smeram/pain-oil.png']
        ],
        [
            'id' => 2, 'store_id' => $storeId, 'category_id' => 1, 'category_name' => 'Hair Care',
            'name' => 'Smeram Naturals 100% Herbal Siddha Hair Oil (200ml)', 'sku' => 'SM-HO-200', 'slug' => 'siddha-hair-oil',
            'price' => 299.00, 'mrp' => 449.00, 'compare_price' => 449.00, 'gst_rate' => 5.0, 'hsn_code' => '33059019',
            'quantity' => 85, 'stock' => 85, 'product_size' => '200 ml', 'net_quantity_value' => 200, 'net_quantity_unit' => 'ml',
            'low_stock_threshold' => 25, 'in_stock' => true, 'active' => true, 'brand' => 'Smeram Naturals',
            'badge_text' => 'Sneha - Kalka - Drava Method · Cold Pressed', 'offer_text' => 'Special Festive Offer - Save ₹150', 'show_offer' => 'show',
            'description' => "- Double Boiled & Double Infused over 72 Hours\\n- Hair Growth Promoter from Deep Roots\\n- 100% Dandruff Control & Scalp Cooling\\n- 100% Natural, Vegan & Cruelty-Free\\n\\nSmeram 100% Natural Herbal Hair Oil is deeply infused with 18 vital ayurvedic herbs including Bhringraj, Amla, Brahmi, Hibiscus, Fenugreek, and cold-pressed Virgin Coconut Oil.",
            'ingredients' => 'Cold pressed Virgin Coconut Oil, Bhringraj, Brahmi, Amla, Hibiscus, Fenugreek, Vetiver, Curry Leaves, Jadamanshi',
            'user_instructions' => 'Take 5-10 ml of Smeram Herbal Hair Oil. Warm gently between palms and apply directly to scalp. Massage with circular fingertip motions for 10 minutes. Leave on for at least 1-2 hours or overnight. Wash off thoroughly with a mild herbal shampoo. Recommended 3 times weekly.',
            'benefits' => "• Clinically proven to reduce hair fall and strengthen root follicles\\n• Deeply conditions scalp, preventing dry flaking and stubborn dandruff\\n• 100% pure cold-pressed natural herbal formulation (HSN 33059019 - 5% GST)",
            'additional_note' => 'Inclusive of 5% GST and free shipping.',
            'variants' => [
                ['id' => 'v3', 'label' => '100 ml', 'size_value' => 100, 'size_unit' => 'ml', 'price' => 199, 'compare_price' => 299, 'sku' => 'SM-HO-100', 'quantity' => 35],
                ['id' => 'v4', 'label' => '200 ml', 'size_value' => 200, 'size_unit' => 'ml', 'price' => 299, 'compare_price' => 449, 'sku' => 'SM-HO-200', 'quantity' => 50]
            ],
            'images' => ['/assets/themes/smeram/hair-oil.png']
        ],
        [
            'id' => 3, 'store_id' => $storeId, 'category_id' => 3, 'category_name' => 'Skin Care & Face Pack',
            'name' => 'Smeram Ayurgold Kumkumadi Face Glow Oil & Herbal Pack', 'sku' => 'SM-FP-050', 'slug' => 'ayurgold-face-oil',
            'price' => 499.00, 'mrp' => 699.00, 'compare_price' => 699.00, 'gst_rate' => 18.0, 'hsn_code' => '33049990',
            'quantity' => 65, 'stock' => 65, 'product_size' => '30 ml', 'net_quantity_value' => 30, 'net_quantity_unit' => 'ml',
            'low_stock_threshold' => 15, 'in_stock' => true, 'active' => true, 'brand' => 'Smeram Naturals',
            'badge_text' => 'Pure Kashmiri Saffron · Ayurvedic Radiance', 'offer_text' => 'Limited Edition Glow Pack', 'show_offer' => 'show',
            'description' => "- Enriched with Pure Grade-1 Kashmiri Saffron\\n- Reduces Dark Spots, Blemishes & Hyper-Pigmentation\\n- Natural Complexion Illuminator for Bridal Glow\\n- Deep Hydration without Greasy Residue\\n\\nAuthentic Kashmiri Saffron, Red Sandalwood, Manjistha, and goat milk concoction.",
            'ingredients' => 'Kashmiri Saffron (Kumkuma), Red Sandalwood, Manjistha, Yashtimadhu, Goat Milk, Sesame Oil',
            'user_instructions' => 'Wash face thoroughly with gentle cleanser. Dispense 3-4 drops onto palms and pat gently across face and neck. Massage upwards until absorbed. For face pack, mix 1 tbsp with rosewater, apply for 15 mins and rinse.',
            'benefits' => "• Reduces dark spots, acne scars, and blemish pigmentation\\n• Enriched with pure Kashmiri Kumkuma (Saffron)\\n• Premium cosmetic Ayurvedic formulation (HSN 33049990 - 18% GST)",
            'additional_note' => 'Inclusive of 18% GST and free shipping.',
            'variants' => [
                ['id' => 'v5', 'label' => '30 ml', 'size_value' => 30, 'size_unit' => 'ml', 'price' => 499, 'compare_price' => 699, 'sku' => 'SM-FP-030', 'quantity' => 40],
                ['id' => 'v6', 'label' => '50 ml', 'size_value' => 50, 'size_unit' => 'ml', 'price' => 799, 'compare_price' => 1199, 'sku' => 'SM-FP-050', 'quantity' => 25]
            ],
            'images' => ['/assets/themes/smeram/face-pack.png']
        ],
        [
            'id' => 4, 'store_id' => $storeId, 'category_id' => 4, 'category_name' => 'Vedic Health Foods',
            'name' => 'Smeram Vedic Multi-Grain Health Mix & Desi Gir Cow Ghee (500g)', 'sku' => 'SM-HM-500', 'slug' => 'vedic-health-mix',
            'price' => 799.00, 'mrp' => 999.00, 'compare_price' => 999.00, 'gst_rate' => 18.0, 'hsn_code' => '19011099',
            'quantity' => 50, 'stock' => 50, 'product_size' => '500 g', 'net_quantity_value' => 500, 'net_quantity_unit' => 'g',
            'low_stock_threshold' => 10, 'in_stock' => true, 'active' => true, 'brand' => 'Smeram Naturals',
            'badge_text' => 'Sprouted 24 Grains · Bilona Churned A2 Ghee', 'offer_text' => 'Wholesome Family Wellness Pack', 'show_offer' => 'show',
            'description' => "- 24 Sprouted Grains, Millets, Pulses & Dry Fruits\\n- Paired with Traditional Bilona A2 Desi Gir Cow Ghee\\n- Complete Nutrition for Immunity, Stamina & Gut Health\\n- Zero Added Refined Sugar, 100% Preservative Free\\n\\nTraditional sprouted multi-millet, sprouted grains, nuts, and cardamom nutritious health mix paired with pure bilona churned A2 Vedic Desi Gir Cow Ghee.",
            'ingredients' => 'Sprouted Ragi, Bajra, Jowar, Wheat, Green Gram, Almonds, Cashews, Cardamom, A2 Desi Gir Cow Ghee',
            'user_instructions' => 'Mix 2 tablespoons of health mix with 200ml cold milk or water. Cook on low flame for 3-5 minutes stirring continuously. Add 1 teaspoon of A2 Desi Ghee and jaggery to taste.',
            'benefits' => "• Sprouted 24 nutritious grains, millets, pulses, and dry fruits\\n• High protein, dietary fiber, and natural calcium\\n• Wholesome dietary nourishment (HSN 19011099 - 18% GST)",
            'additional_note' => 'Inclusive of 18% GST and free shipping.',
            'variants' => [
                ['id' => 'v7', 'label' => '500 g', 'size_value' => 500, 'size_unit' => 'g', 'price' => 799, 'compare_price' => 999, 'sku' => 'SM-HM-500', 'quantity' => 30],
                ['id' => 'v8', 'label' => '1 kg', 'size_value' => 1000, 'size_unit' => 'g', 'price' => 1449, 'compare_price' => 1899, 'sku' => 'SM-HM-1000', 'quantity' => 20]
            ],
            'images' => ['/assets/themes/smeram/health-mix.png']
        ]
    ];
    // Check if custom overrides exist
    $overrideFile = __DIR__ . '/products_catalog.json';
    if (is_file($overrideFile)) {
        $saved = json_decode(file_get_contents($overrideFile), true);
        if (is_array($saved) && !empty($saved)) {
            return $saved;
        }
    }
    return $defaults;"""

if old_prod_fallback in c:
    c = c.replace(old_prod_fallback, new_prod_fallback)
    print("Updated zkcGetProducts with full fields & catalog fallback")

# Update PUT /products/:id to persist all fields
old_save_handler = """if (preg_match('#^products/(\\\\d+)$#', $route, $pm) && ($method === 'PUT' || $method === 'POST')) {
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
}"""

new_save_handler = """if (preg_match('#^products/(\\\\d+)$#', $route, $pm) && ($method === 'PUT' || $method === 'POST')) {
    $prodId = (int)$pm[1];
    $overrideFile = __DIR__ . '/products_catalog.json';
    $catalog = zkcGetProducts($pdo);

    $foundIndex = -1;
    foreach ($catalog as $idx => $item) {
        if ((int)$item['id'] === $prodId) {
            $foundIndex = $idx;
            break;
        }
    }

    $item = ($foundIndex >= 0) ? $catalog[$foundIndex] : ['id' => $prodId];

    // Merge incoming fields
    foreach ($body as $k => $v) {
        $item[$k] = $v;
    }

    $item['id'] = $prodId;
    $rate = (float)($item['gst_rate'] ?? 5.0);
    $price = (float)($item['price'] ?? 0.0);
    $taxable = round($price * 100.0 / (100.0 + $rate), 2);
    $gstAmt = round($price - $taxable, 2);
    $item['taxable_value'] = $taxable;
    $item['gst_amount'] = $gstAmt;
    $item['cgst_amount'] = round($gstAmt / 2.0, 2);
    $item['sgst_amount'] = round($gstAmt - round($gstAmt / 2.0, 2), 2);

    if (empty($item['hsn_code'])) {
        $item['hsn_code'] = ($rate == 5.0 ? '30049013' : '33049990');
    }

    // If variants exist, recalculate master stock quantity
    if (!empty($item['variants']) && is_array($item['variants'])) {
        $totStock = 0;
        foreach ($item['variants'] as $var) {
            $totStock += (int)($var['quantity'] ?? 0);
        }
        $item['quantity'] = $totStock;
        $item['stock'] = $totStock;
    } else {
        $item['stock'] = (int)($item['quantity'] ?? ($item['stock'] ?? 100));
    }

    if ($foundIndex >= 0) {
        $catalog[$foundIndex] = $item;
    } else {
        $catalog[] = $item;
    }

    @file_put_contents($overrideFile, json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    // Also update SQL if database table exists
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `products` SET name = ?, price = ?, quantity = ?, gst_rate = ?, hsn_code = ? WHERE id = ?");
            $stmt->execute([$item['name'] ?? '', $price, $item['quantity'], $rate, $item['hsn_code'], $prodId]);
        } catch (Exception $e) {}
    }

    respond([
        'success' => true,
        'product' => $item
    ]);
}"""

if old_save_handler in c:
    c = c.replace(old_save_handler, new_save_handler)
    print("Updated products save handler with full field persistence")

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated api.php successfully!")

