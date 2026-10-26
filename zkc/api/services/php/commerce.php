<?php
/**
 * Commerce rules for the PHP + MySQL package — the same rules as the Node API:
 * sizes and stock (services/inventory.js), coupons, shipping rates and GST (routes/storefront.js),
 * invoices (routes/invoices.js), WhatsApp sending (services/wa-sender.js) and shipping (services/shipping.js).
 * Copied as-is into every PHP deployment. Needs store_config.php, db_config.php and whatsapp_orders.php first.
 */

function zkcError($message, $status) { return new RuntimeException($message, $status); }

// ── Sizes and stock ─────────────────────────────────────
// Stock lives in `product_stock` (one row per product, or per size). Package upgrades add rows for new
// products / sizes but never overwrite counts, so sales on this site are not undone by a redeploy.

function zkcActiveVariants($p) {
    $v = json_decode((string)($p['variants'] ?? '[]'), true);
    if (!is_array($v)) return [];
    return array_values(array_filter($v, function ($x) { return is_array($x) && !empty($x['id']) && ($x['active'] ?? true) !== false; }));
}

function zkcFindVariant($p, $variantId) {
    foreach (zkcActiveVariants($p) as $v) if ((string)$v['id'] === (string)$variantId) return $v;
    return null;
}

function zkcThresholdFor($p) {
    if (isset($p['low_stock_threshold']) && $p['low_stock_threshold'] !== null && $p['low_stock_threshold'] !== '') return (int)$p['low_stock_threshold'];
    return (int)zkcConstOr('LOW_STOCK_THRESHOLD', 50);
}

function zkcConstOr($name, $default) { return defined($name) ? constant($name) : $default; }

/** Current stock for a product / size; creates the row from products.quantity the first time. */
function zkcStockRow($pdo, $p, $variantId, $lock = false) {
    $vid = (string)($variantId ?? '');
    $stmt = $pdo->prepare('SELECT quantity FROM product_stock WHERE product_id = ? AND variant_id = ?' . ($lock ? ' FOR UPDATE' : ''));
    $stmt->execute([(int)$p['id'], $vid]);
    $row = $stmt->fetch();
    if ($row) return (int)$row['quantity'];
    $start = $vid !== '' ? (int)((zkcFindVariant($p, $vid) ?: [])['quantity'] ?? 0) : (int)($p['quantity'] ?? 0);
    $pdo->prepare('INSERT IGNORE INTO product_stock (store_id, product_id, variant_id, quantity) VALUES (?,?,?,?)')->execute([STORE_ID, (int)$p['id'], $vid, $start]);
    if ($lock) return zkcStockRow($pdo, $p, $vid, true);
    return $start;
}

function zkcProduct($pdo, $id, $lock = false) {
    $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ? AND store_id = ?' . ($lock ? ' FOR UPDATE' : ''));
    $stmt->execute([(int)$id, STORE_ID]);
    return $stmt->fetch() ?: null;
}

/** Throws 409 when a line asks for more than is in stock (same messages as the Node checkout). */
function zkcCheckAvailability($pdo, $lines) {
    $need = [];
    foreach ($lines as $l) {
        $k = $l['product_id'] . ':' . ($l['variant_id'] ?? '');
        $need[$k] = ($need[$k] ?? 0) + (int)$l['quantity'];
    }
    foreach ($need as $k => $qty) {
        list($pid, $vid) = explode(':', $k, 2);
        $p = zkcProduct($pdo, $pid);
        $have = zkcStockRow($pdo, $p, $vid);
        if ($have >= $qty) continue;
        $label = $p['name'] . ($vid !== '' ? ' (' . ((zkcFindVariant($p, $vid) ?: [])['label'] ?? '') . ')' : '');
        throw zkcError($have > 0 ? "Only $have left of $label" : "$label is out of stock", 409);
    }
}

/** Move stock by sign × quantity per line. Returns products that crossed their low-stock level. Run inside a transaction. */
function zkcApplyStock($pdo, $lines, $sign, $reason, $orderId = null, $allowNegative = false) {
    $crossings = [];
    foreach ($lines as $l) {
        $p = zkcProduct($pdo, $l['product_id'], true);
        if (!$p) continue;
        $vid = (string)($l['variant_id'] ?? '');
        $before = zkcStockRow($pdo, $p, $vid, true);
        $after = $before + $sign * (int)$l['quantity'];
        if ($after < 0 && !$allowNegative) throw zkcError('Not enough stock for ' . $p['name'], 409);
        $pdo->prepare('UPDATE product_stock SET quantity = ? WHERE product_id = ? AND variant_id = ?')->execute([$after, (int)$p['id'], $vid]);
        $pdo->prepare('INSERT INTO inventory_movements (store_id, product_id, variant_id, delta, quantity_after, reason, order_id) VALUES (?,?,?,?,?,?,?)')
            ->execute([STORE_ID, (int)$p['id'], $vid, $sign * (int)$l['quantity'], $after, $reason, $orderId]);
        zkcSyncProductTotals($pdo, $p);
        $threshold = zkcThresholdFor($p);
        if ($sign < 0 && $before > $threshold && $after <= $threshold) {
            $v = $vid !== '' ? zkcFindVariant($p, $vid) : null;
            $crossings[] = ['product_id' => (int)$p['id'], 'name' => $p['name'], 'variant' => $v ? '(' . $v['label'] . ')' : '', 'quantity' => $after, 'threshold' => $threshold];
        }
    }
    return $crossings;
}

/** products.quantity / in_stock follow the stock rows (sum of sizes). */
function zkcSyncProductTotals($pdo, $p) {
    $vids = array_map(function ($v) { return (string)$v['id']; }, zkcActiveVariants($p));
    if ($vids) {
        $marks = implode(',', array_fill(0, count($vids), '?'));
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(quantity),0) FROM product_stock WHERE product_id = ? AND variant_id IN ($marks)");
        $stmt->execute(array_merge([(int)$p['id']], $vids));
    } else {
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(quantity),0) FROM product_stock WHERE product_id = ? AND variant_id = ''");
        $stmt->execute([(int)$p['id']]);
    }
    $total = (int)$stmt->fetchColumn();
    $pdo->prepare('UPDATE products SET quantity = ?, in_stock = ? WHERE id = ?')->execute([$total, $total > 0 ? 1 : 0, (int)$p['id']]);
}

function zkcLinesFromOrder($o) {
    $lines = [];
    foreach (zkcOrderItems($o) as $i) $lines[] = ['product_id' => (int)($i['product_id'] ?? 0), 'variant_id' => $i['variant_id'] ?? '', 'quantity' => (int)($i['quantity'] ?? 1)];
    return array_values(array_filter($lines, function ($l) { return $l['product_id'] > 0; }));
}

/** Take an order's stock once (orders.stock_deducted guards against doing it twice). */
function zkcDeductForOrder($pdo, $orderId, $allowNegative = false) {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND store_id = ? FOR UPDATE');
    $stmt->execute([(int)$orderId, STORE_ID]);
    $o = $stmt->fetch();
    if (!$o || (int)$o['stock_deducted'] === 1) return [];
    $crossings = zkcApplyStock($pdo, zkcLinesFromOrder($o), -1, 'order', (int)$o['id'], $allowNegative);
    $pdo->prepare('UPDATE orders SET stock_deducted = 1 WHERE id = ?')->execute([(int)$o['id']]);
    return $crossings;
}

function zkcRestockForOrder($pdo, $orderId) {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND store_id = ? FOR UPDATE');
    $stmt->execute([(int)$orderId, STORE_ID]);
    $o = $stmt->fetch();
    if (!$o || (int)$o['stock_deducted'] !== 1) return;
    zkcApplyStock($pdo, zkcLinesFromOrder($o), 1, 'cancel', (int)$o['id'], true);
    $pdo->prepare('UPDATE orders SET stock_deducted = 0 WHERE id = ?')->execute([(int)$o['id']]);
}

/** Set an exact count (stock-take / delivery from the supplier). */
function zkcSetStock($pdo, $productId, $variantId, $quantity, $note = '') {
    $pdo->beginTransaction();
    try {
        $p = zkcProduct($pdo, $productId, true);
        if (!$p) throw zkcError('Product not found', 404);
        $vid = (string)($variantId ?? '');
        if ($vid !== '' && !zkcFindVariant($p, $vid)) throw zkcError('Size not found', 404);
        $before = zkcStockRow($pdo, $p, $vid, true);
        $q = max(0, (int)$quantity);
        $pdo->prepare('UPDATE product_stock SET quantity = ? WHERE product_id = ? AND variant_id = ?')->execute([$q, (int)$p['id'], $vid]);
        $pdo->prepare('INSERT INTO inventory_movements (store_id, product_id, variant_id, delta, quantity_after, reason, note) VALUES (?,?,?,?,?,?,?)')
            ->execute([STORE_ID, (int)$p['id'], $vid, $q - $before, $q, 'adjust', mb_substr((string)$note, 0, 200)]);
        zkcSyncProductTotals($pdo, $p);
        $pdo->commit();
        return ['before' => $before, 'quantity' => $q];
    } catch (Exception $e) { $pdo->rollBack(); throw $e; }
}

/** Rows for the stock page: one per product, or one per size. */
function zkcStockOverview($pdo) {
    $out = [];
    $stmt = $pdo->prepare('SELECT * FROM products WHERE store_id = ? AND active = 1 ORDER BY name');
    $stmt->execute([STORE_ID]);
    foreach ($stmt->fetchAll() as $p) {
        $sizes = zkcActiveVariants($p);
        $threshold = zkcThresholdFor($p);
        if (!$sizes) $out[] = ['product_id' => (int)$p['id'], 'variant_id' => '', 'name' => $p['name'], 'size' => (string)($p['product_size'] ?? ''), 'sku' => (string)($p['sku'] ?? ''), 'quantity' => zkcStockRow($pdo, $p, ''), 'threshold' => $threshold];
        foreach ($sizes as $v) $out[] = ['product_id' => (int)$p['id'], 'variant_id' => (string)$v['id'], 'name' => $p['name'], 'size' => (string)$v['label'], 'sku' => (string)($v['sku'] ?? ''), 'quantity' => zkcStockRow($pdo, $p, $v['id']), 'threshold' => $threshold];
    }
    return $out;
}

// ── Coupons, shipping, GST ──────────────────────────────

function zkcFindCoupon($pdo, $code, $lock = false) {
    $stmt = $pdo->prepare('SELECT * FROM coupons WHERE store_id = ? AND UPPER(code) = UPPER(?) AND active = 1
        AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
        AND (usage_limit IS NULL OR used_count < usage_limit)' . ($lock ? ' FOR UPDATE' : ''));
    $stmt->execute([STORE_ID, trim((string)$code)]);
    return $stmt->fetch() ?: null;
}

function zkcCouponDiscount($c, $subtotal) {
    return $c['discount_type'] === 'percent' ? (float)round($subtotal * (float)$c['discount_value'] / 100) : min($subtotal, (float)$c['discount_value']);
}

function zkcPostal($v) { return substr(preg_replace('/\D/', '', (string)$v), 0, 12); }

function zkcShippingRates($pdo, $subtotal, $postal) {
    $stmt = $pdo->prepare("SELECT id, name, courier, estimated_days, CASE WHEN free_above IS NOT NULL AND ? >= free_above THEN 0 ELSE rate END AS amount
        FROM shipping_rates WHERE store_id = ? AND active = 1 AND (postal_prefix IS NULL OR (? <> '' AND ? LIKE CONCAT(postal_prefix, '%')))
        ORDER BY (postal_prefix IS NOT NULL) DESC, rate ASC");
    $stmt->execute([(float)$subtotal, STORE_ID, $postal, $postal]);
    return array_map(function ($r) { return ['id' => (int)$r['id'], 'name' => $r['name'], 'courier' => $r['courier'], 'estimated_days' => $r['estimated_days'], 'amount' => (float)$r['amount']]; }, $stmt->fetchAll());
}

function zkcGstRate() { return zkcConstOr('GST_ENABLED', false) ? (float)zkcConstOr('GST_RATE', 0) : 0.0; }

// ── Invoices ────────────────────────────────────────────

/** Same numbering as the Node dashboard: ZK-<store>-<order>. Only for confirmed orders. */
function zkcEnsureInvoice($pdo, $o) {
    $active = in_array($o['order_status'], ['new', 'confirmed', 'processing', 'shipped', 'delivered'], true);
    $paid = in_array($o['payment_status'], ['paid', 'cod'], true);
    if (!$active || !$paid) throw zkcError('An invoice can only be issued for a confirmed order', 409);
    $number = 'ZK-' . STORE_ID . '-' . (int)$o['id'];
    $pdo->prepare('INSERT IGNORE INTO invoices (store_id, order_id, invoice_number) VALUES (?,?,?)')->execute([STORE_ID, (int)$o['id'], $number]);
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE order_id = ?');
    $stmt->execute([(int)$o['id']]);
    return $stmt->fetch();
}

// ── WhatsApp sender (ZKWAConnect / Gupshup, from whatsapp_config.php) ──

function zkcWaPost($url, $headers, $body, $json = true) {
    if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'The PHP curl extension is required for WhatsApp sending'];
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $json ? json_encode($body, JSON_UNESCAPED_UNICODE) : http_build_query($body)]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    $data = json_decode((string)$raw, true);
    return ['ok' => $raw !== false && $status >= 200 && $status < 300, 'status' => $status, 'data' => is_array($data) ? $data : [], 'error' => $err];
}

function zkcWaProviderSend($to, $text, $template, $variables) {
    $provider = zkcConstOr('WA_PROVIDER', 'none');
    if ($provider === 'zkwaconnect') {
        $base = rtrim((string)zkcConstOr('ZKWA_BASE_URL', ''), '/');
        $key = (string)zkcConstOr('ZKWA_API_KEY', '');
        if ($base === '' || $key === '') return ['ok' => false, 'error' => 'ZKWAConnect URL or API key is not set'];
        $body = $template
            ? ['to' => $to, 'type' => 'template', 'template' => array_filter(['name' => $template['name'], 'language' => $template['language'] ?? 'en', 'variables' => $variables], function ($v) { return $v !== null; })]
            : ['to' => $to, 'type' => 'text', 'text' => ['body' => $text]];
        if (zkcConstOr('ZKWA_PHONE_NUMBER_ID', '') !== '') $body['phone_number_id'] = ZKWA_PHONE_NUMBER_ID;
        $r = zkcWaPost($base . '/api/v1/messages', ['Content-Type: application/json', 'Authorization: Bearer ' . $key], $body);
        if ($r['ok']) return ['ok' => true];
        $e = $r['data']['error'] ?? null;
        return ['ok' => false, 'error' => is_array($e) ? ($e['message'] ?? ($e['code'] ?? 'HTTP ' . $r['status'])) : ($r['error'] ?: 'HTTP ' . $r['status']), 'code' => is_array($e) ? ($e['code'] ?? null) : null];
    }
    if ($provider === 'gupshup') {
        $key = (string)zkcConstOr('GUPSHUP_API_KEY', '');
        $source = (string)zkcConstOr('GUPSHUP_SOURCE_NUMBER', '');
        if ($key === '' || $source === '') return ['ok' => false, 'error' => 'Gupshup API key or source number is not set'];
        $form = ['channel' => 'whatsapp', 'source' => $source, 'destination' => $to, 'src.name' => zkcConstOr('GUPSHUP_APP_NAME', '') ?: 'ZKCommerce'];
        $url = 'https://api.gupshup.io/wa/api/v1/msg';
        if ($template) { $url = 'https://api.gupshup.io/wa/api/v1/template/msg'; $form['template'] = json_encode(['id' => $template['name'], 'params' => $variables]); }
        else $form['message'] = json_encode(['type' => 'text', 'text' => $text], JSON_UNESCAPED_UNICODE);
        $r = zkcWaPost($url, ['apikey: ' . $key, 'Content-Type: application/x-www-form-urlencoded'], $form, false);
        if ($r['ok'] && ($r['data']['status'] ?? '') !== 'error') return ['ok' => true];
        return ['ok' => false, 'error' => $r['data']['message'] ?? ('HTTP ' . $r['status'])];
    }
    return ['ok' => false, 'error' => 'Automatic sending is off (provider: none)'];
}

function zkcWaPhone($phone) {
    $d = preg_replace('/\D/', '', (string)$phone);
    if (strlen($d) === 10) $d = '91' . $d;
    elseif (strlen($d) === 11 && $d[0] === '0') $d = '91' . substr($d, 1);
    return strlen($d) >= 10 ? $d : '';
}

/** Send one message (or queue it as a one-click link) and record it in whatsapp_outbox. Never throws. */
function zkcWaSend($pdo, $kind, $to, $text, $fields = [], $orderId = null, $productId = null) {
    $phone = zkcWaPhone($to);
    if ($phone === '') return ['status' => 'failed', 'error' => 'No valid WhatsApp number', 'wa_link' => null];
    $templates = json_decode((string)zkcConstOr('WA_TEMPLATES', '{}'), true) ?: [];
    $auto = json_decode((string)zkcConstOr('WA_AUTO', '{}'), true) ?: [];
    $template = !empty($templates[$kind]['name']) ? $templates[$kind] : null;
    $variables = [];
    if ($template && trim((string)($template['variables'] ?? '')) !== '') {
        foreach (explode('|', $template['variables']) as $v) $variables[] = zkcRenderOrderMessage(trim($v), $fields) ?: '-';
    }
    $provider = zkcConstOr('WA_PROVIDER', 'none');
    $autoOn = ($auto[$kind] ?? true) !== false;
    $r = $autoOn ? zkcWaProviderSend($phone, $text, $template, $variables) : ['ok' => false, 'error' => 'Automatic sending is off for this message type'];
    $status = $r['ok'] ? 'sent' : (($provider === 'none' || !$autoOn) ? 'pending' : 'failed');
    $error = $r['ok'] ? null : ((($r['code'] ?? '') === 'window_closed') ? 'Needs an approved template (customer has not messaged in 24 h).' : $r['error']);
    $id = null;
    try {
        $pdo->prepare('INSERT INTO whatsapp_outbox (store_id, kind, to_phone, message, provider, status, error, order_id, product_id, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
            ->execute([STORE_ID, $kind, $phone, $text, $provider, $status, $error, $orderId, $productId, $r['ok'] ? date('Y-m-d H:i:s') : null]);
        $id = (int)$pdo->lastInsertId();
    } catch (Exception $e) { error_log('[WhatsApp outbox] ' . $e->getMessage()); }
    return ['id' => $id, 'status' => $status, 'error' => $error, 'wa_link' => 'https://wa.me/' . $phone . '?text=' . rawurlencode($text)];
}

function zkcOrderById($pdo, $id) {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND store_id = ?');
    $stmt->execute([(int)$id, STORE_ID]);
    return $stmt->fetch() ?: null;
}

/** New confirmed / paid order: confirmation to the customer + alert to customer care. */
function zkcNotifyOrderConfirmed($pdo, $o) {
    if (!zkcConstOr('WA_ENABLED', false)) return [];
    $out = [];
    if (!empty($o['customer_phone'])) $out[] = zkcWaSend($pdo, 'order_confirmation', $o['customer_phone'], zkcRenderOrderMessage(WA_CUSTOMER_TEMPLATE, $o), $o, (int)$o['id']);
    if (zkcConstOr('WA_CARE_NUMBER', '') !== '') $out[] = zkcWaSend($pdo, 'care_alert', WA_CARE_NUMBER, zkcRenderOrderMessage(WA_CARE_TEMPLATE, $o), $o, (int)$o['id']);
    return $out;
}

function zkcNotifyLowStock($pdo, $crossings) {
    if (!$crossings || !zkcConstOr('LOW_STOCK_ALERTS', true) || zkcConstOr('WA_CARE_NUMBER', '') === '') return [];
    $out = [];
    foreach ($crossings as $c) {
        $f = ['product_name' => $c['name'], 'variant' => $c['variant'], 'stock_left' => (string)$c['quantity'], 'threshold' => (string)$c['threshold']];
        $out[] = zkcWaSend($pdo, 'low_stock', WA_CARE_NUMBER, zkcRenderOrderMessage(zkcConstOr('WA_LOW_STOCK_TEMPLATE', ''), $f), $f, null, $c['product_id']);
    }
    return $out;
}

function zkcNotifyShipment($pdo, $o, $stage) {
    if (!zkcConstOr('WA_ENABLED', false) || empty($o['customer_phone'])) return [];
    $kind = $stage === 'delivered' ? 'order_delivered' : 'order_shipped';
    $tpl = $stage === 'delivered' ? zkcConstOr('WA_DELIVERED_TEMPLATE', '') : zkcConstOr('WA_SHIPPED_TEMPLATE', '');
    return [zkcWaSend($pdo, $kind, $o['customer_phone'], zkcRenderOrderMessage($tpl, $o), $o, (int)$o['id'])];
}

// ── Payment and status changes ──────────────────────────

/** Order became paid (verify or webhook, whichever is first): stock, notifications, hand-off link. */
function zkcAfterPaid($pdo, $orderId) {
    $pdo->beginTransaction();
    try { $low = zkcDeductForOrder($pdo, $orderId, true); $pdo->commit(); }
    catch (Exception $e) { $pdo->rollBack(); error_log('[Stock] ' . $e->getMessage()); $low = []; }
    $o = zkcOrderById($pdo, $orderId);
    $wa = $o ? zkcNotifyOrderConfirmed($pdo, $o) : [];
    zkcNotifyLowStock($pdo, $low);
    return ['order' => $o, 'whatsapp' => $wa];
}

/** Mark an order paid once. Returns true only for the call that changed it. */
function zkcMarkPaid($pdo, $orderId, $paymentId) {
    $stmt = $pdo->prepare("UPDATE orders SET payment_status = 'paid', order_status = 'new', razorpay_payment_id = ?, paid_at = NOW() WHERE id = ? AND store_id = ? AND payment_status <> 'paid'");
    $stmt->execute([$paymentId, (int)$orderId, STORE_ID]);
    return $stmt->rowCount() === 1;
}

function zkcCleanAwb($awb) {
    $v = strtoupper(preg_replace('/\s+/', '', (string)$awb));
    if (!preg_match('/^[A-Z0-9-]{6,32}$/', $v)) throw zkcError('AWB must be 6–32 letters, numbers or dashes', 400);
    return $v;
}

function zkcTrackingUrl($awb) {
    return $awb ? str_replace('{awb}', rawurlencode($awb), (string)zkcConstOr('SHIP_TRACKING_URL', 'https://ekartlogistics.com/shipmenttrack/{awb}')) : null;
}

/** Save (or clear) the AWB of one order. */
function zkcAssignAwb($pdo, $orderId, $awb, $courier = '') {
    $value = ($awb === null || $awb === '') ? null : zkcCleanAwb($awb);
    if ($value) {
        $dup = $pdo->prepare('SELECT order_number FROM orders WHERE store_id = ? AND tracking_number = ? AND id <> ? LIMIT 1');
        $dup->execute([STORE_ID, $value, (int)$orderId]);
        if ($n = $dup->fetchColumn()) throw zkcError("AWB $value is already on order $n", 400);
    }
    $courier = trim((string)$courier) ?: zkcConstOr('SHIP_COURIER', 'Ekart');
    $pdo->prepare('UPDATE orders SET tracking_number = ?, courier = ?, tracking_url = ? WHERE id = ? AND store_id = ?')
        ->execute([$value, $value ? mb_substr($courier, 0, 40) : null, $value ? zkcTrackingUrl($value) : null, (int)$orderId, STORE_ID]);
    return zkcOrderById($pdo, $orderId);
}

const ZKC_STATUSES = ['pending', 'new', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

/** Status change with stock and WhatsApp, like PUT /api/orders/:id/status. Returns ['order', 'whatsapp']. */
function zkcChangeStatus($pdo, $orderId, $status, $awb = null) {
    if (!in_array($status, ZKC_STATUSES, true)) throw zkcError('Invalid status', 400);
    $awb = ($awb !== null && $awb !== '') ? zkcCleanAwb($awb) : null;
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND store_id = ? FOR UPDATE');
        $stmt->execute([(int)$orderId, STORE_ID]);
        $prev = $stmt->fetch();
        if (!$prev) throw zkcError('Order not found', 404);
        $pdo->prepare("UPDATE orders SET order_status = ?,
              tracking_number = COALESCE(?, tracking_number), courier = COALESCE(?, courier), tracking_url = COALESCE(?, tracking_url),
              shipped_at = CASE WHEN ? IN ('shipped','delivered') THEN COALESCE(shipped_at, NOW()) ELSE shipped_at END,
              delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END
            WHERE id = ?")
            ->execute([$status, $awb, $awb ? zkcConstOr('SHIP_COURIER', 'Ekart') : null, $awb ? zkcTrackingUrl($awb) : null, $status, $status, (int)$orderId]);
        $low = [];
        if (in_array($status, ['cancelled', 'returned'], true)) zkcRestockForOrder($pdo, $orderId);
        elseif (in_array($prev['order_status'], ['cancelled', 'returned'], true) && in_array($status, ['new', 'processing', 'shipped', 'delivered'], true) && in_array($prev['payment_status'], ['paid', 'cod'], true))
            $low = zkcDeductForOrder($pdo, $orderId, true);
        $pdo->commit();
    } catch (Exception $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    zkcNotifyLowStock($pdo, $low);
    $o = zkcOrderById($pdo, $orderId);
    $wa = (in_array($status, ['shipped', 'delivered'], true) && $prev['order_status'] !== $status) ? zkcNotifyShipment($pdo, $o, $status) : [];
    return ['order' => $o, 'whatsapp' => $wa];
}
