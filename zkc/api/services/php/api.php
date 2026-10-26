<?php
/**
 * Storefront API for PHP + MySQL hosting.
 * The storefront's fetch('/api/...') calls are routed here as api.php?route=... by a small script in each page.
 * Same rules as the Node API: sizes and stock, coupons, shipping rates, GST, Razorpay (verify + webhook), WhatsApp.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';
if (is_file(__DIR__ . '/payment_config.php')) require_once __DIR__ . '/payment_config.php';
if (is_file(__DIR__ . '/whatsapp_config.php')) require_once __DIR__ . '/whatsapp_config.php';
require_once __DIR__ . '/whatsapp_orders.php';
require_once __DIR__ . '/commerce.php';
require_once __DIR__ . '/packaging_api.php';
if (!defined('CHECKOUT_COD')) define('CHECKOUT_COD', true);
if (!defined('CHECKOUT_RAZORPAY')) define('CHECKOUT_RAZORPAY', false);
if (!defined('CHECKOUT_COUPON')) define('CHECKOUT_COUPON', false);

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** JSON error for an exception: our own RuntimeExceptions carry the HTTP status as their code. */
function respondError($e) {
    $status = ($e instanceof RuntimeException && $e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 500;
    if ($status === 500) error_log('[api.php] ' . $e->getMessage());
    respond(['error' => $status === 500 ? 'Something went wrong. Please try again.' : $e->getMessage()], $status);
}

$route  = trim($_GET['route'] ?? '', '/');
$method = $_SERVER['REQUEST_METHOD'];
$raw    = file_get_contents('php://input');
$body   = json_decode($raw, true);
if (!is_array($body)) $body = $_POST;

$pdo = getDbConnection();
if ($route === 'health') respond(['status' => $pdo ? 'ok' : 'error', 'db' => $pdo ? 'connected' : 'disconnected', 'store' => STORE_SLUG, 'env' => STORE_ENV, 'version' => PACKAGE_VERSION]);
if (!$pdo) respond(['error' => 'The store database is not reachable. Check db_config.php.'], 503);
// Store order times in IST (DATETIME defaults follow the session time zone).
try { $pdo->exec("SET time_zone = '+05:30'"); } catch (Exception $e) { /* keep the server default */ }

// Merchant tools (packaging labels, shipments, stock), behind the admin-orders.php login.
if (strpos($route, 'admin/') === 0) zkcHandleAdminRoute($pdo, $route, $method, $body);

if (preg_match('#^storefront/[^/]+/shipping-rates$#', $route)) {
    respond(['rates' => zkcShippingRates($pdo, max(0, (float)($_GET['subtotal'] ?? 0)), zkcPostal($_GET['postal_code'] ?? ''))]);
}

if (preg_match('#^coupons/validate/#', $route) && $method === 'POST') {
    $code = trim((string)($body['code'] ?? ''));
    $amount = $body['subtotal'] ?? null;
    if ($code === '' || !is_numeric($amount) || (float)$amount < 0) respond(['valid' => false, 'error' => 'Coupon code and a non-negative subtotal are required'], 400);
    $c = zkcFindCoupon($pdo, $code);
    if (!$c) respond(['valid' => false, 'error' => 'Coupon is invalid or expired'], 404);
    if ((float)$amount < (float)$c['minimum_order']) respond(['valid' => false, 'error' => 'Minimum order amount not met'], 400);
    respond(['valid' => true, 'code' => $c['code'], 'discount' => zkcCouponDiscount($c, (float)$amount)]);
}

if (preg_match('#^storefront/[^/]+/checkout$#', $route) && $method === 'POST') {
    $customer = $body['customer'] ?? [];
    $address  = $body['address'] ?? [];
    $name  = trim($customer['name'] ?? '');
    $phone = trim($customer['phone'] ?? '');
    $email = trim($customer['email'] ?? '');
    $line1 = trim($address['line1'] ?? '');
    if ($name === '' || $phone === '' || $line1 === '') respond(['error' => 'Name, phone and delivery address are required.'], 400);
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) respond(['error' => 'Enter a valid email address'], 400);
    // Merchant checkout settings (store_config.php) are enforced here, not only in the page.
    $payMethod = ($body['payment_method'] ?? 'cod') === 'razorpay' ? 'razorpay' : 'cod';
    if ($payMethod === 'cod' && !CHECKOUT_COD) respond(['error' => 'Cash on delivery is not available for this store. Please pay online.'], 400);
    if ($payMethod === 'razorpay' && !CHECKOUT_RAZORPAY) respond(['error' => 'Online payment is not available for this store.'], 400);
    $couponCode = trim((string)($body['coupon_code'] ?? ''));
    if ($couponCode !== '' && !CHECKOUT_COUPON) respond(['error' => 'Discount codes are not available for this store.'], 400);
    $cart = $body['items'] ?? [];
    if (!is_array($cart) || !$cart || count($cart) > 50) respond(['error' => 'Customer name and 1-50 cart items are required'], 400);

    $pdo->beginTransaction();
    try {
        $items = [];
        $subtotal = 0.0;
        foreach ($cart as $item) {
            $qty = filter_var($item['quantity'] ?? 1, FILTER_VALIDATE_INT);
            $p = zkcProduct($pdo, (int)($item['product_id'] ?? 0));
            if (!$p || (int)$p['active'] !== 1 || $qty === false || $qty < 1 || $qty > 999) throw zkcError('A product in your cart is no longer available.', 400);
            $vid = (string)($item['variant_id'] ?? '');
            $v = $vid !== '' ? zkcFindVariant($p, $vid) : null;
            if ($vid !== '' && !$v) throw zkcError('That size of ' . $p['name'] . ' is no longer available', 400);
            if (!$v && zkcActiveVariants($p)) throw zkcError('Choose a size for ' . $p['name'], 400);
            $price = (float)($v ? $v['price'] : $p['price']);
            $subtotal += $price * $qty;
            $items[] = ['product_id' => (int)$p['id'], 'name' => $p['name'], 'variant_id' => $v ? (string)$v['id'] : null, 'variant' => $v ? $v['label'] : null,
                'size' => $v ? $v['label'] : $p['product_size'], 'sku' => ($v && !empty($v['sku'])) ? $v['sku'] : $p['sku'], 'quantity' => $qty, 'price' => $price];
        }
        zkcCheckAvailability($pdo, $items);

        $coupon = null;
        $discount = 0.0;
        if ($couponCode !== '') {
            $coupon = zkcFindCoupon($pdo, $couponCode, true);
            if (!$coupon) throw zkcError('Coupon is invalid, expired, or its usage limit was reached', 400);
            if ($subtotal < (float)$coupon['minimum_order']) throw zkcError('This coupon requires a minimum subtotal of ₹' . (int)$coupon['minimum_order'], 400);
            $discount = zkcCouponDiscount($coupon, $subtotal);
        }
        $shipping = 0.0;
        $rateId = null;
        if (!empty($body['shipping_rate_id'])) {
            $postal = zkcPostal($address['pincode'] ?? '');
            $stmt = $pdo->prepare("SELECT id, rate, free_above FROM shipping_rates WHERE id = ? AND store_id = ? AND active = 1 AND (postal_prefix IS NULL OR (? <> '' AND ? LIKE CONCAT(postal_prefix, '%')))");
            $stmt->execute([(int)$body['shipping_rate_id'], STORE_ID, $postal, $postal]);
            $rate = $stmt->fetch();
            if (!$rate) throw zkcError('The selected shipping rate is no longer available for this address', 400);
            $rateId = (int)$rate['id'];
            $shipping = ($rate['free_above'] !== null && $subtotal >= (float)$rate['free_above']) ? 0.0 : (float)$rate['rate'];
        }
        $gstRate = zkcGstRate();
        $taxable = max(0, $subtotal - $discount);
        $gst = (float)round($taxable * $gstRate / 100);
        $total = $taxable + $gst + $shipping;

        $orderNumber = 'ORD-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        // COD orders are confirmed now; Razorpay orders stay 'pending' until the payment is verified.
        $pdo->prepare('INSERT INTO orders (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json,
                subtotal, discount_amount, gst_rate, gst_amount, shipping_amount, shipping_rate_id, coupon_code, total_amount, payment_method, payment_status, order_status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([STORE_ID, $orderNumber, mb_substr($name, 0, 120), $phone, $email, $line1, $address['city'] ?? '', $address['state'] ?? '', $address['pincode'] ?? '',
                json_encode($items, JSON_UNESCAPED_UNICODE), $subtotal, $discount, $gstRate, $gst, $shipping, $rateId, $coupon ? $coupon['code'] : null, $total,
                $payMethod, $payMethod === 'cod' ? 'cod' : 'unpaid', $payMethod === 'cod' ? 'new' : 'pending']);
        $orderId = (int)$pdo->lastInsertId();
        if ($coupon) $pdo->prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?')->execute([(int)$coupon['id']]);
        // COD is confirmed now, so its stock is taken in the same transaction; Razorpay orders take stock once paid.
        $low = $payMethod === 'cod' ? zkcDeductForOrder($pdo, $orderId) : [];
        $pdo->commit();
    } catch (Exception $e) { if ($pdo->inTransaction()) $pdo->rollBack(); respondError($e); }

    $wa = null;
    $handoff = null;
    if ($payMethod === 'cod') {
        $order = zkcOrderById($pdo, $orderId);
        zkcEnsureInvoice($pdo, $order);
        $handoff = zkcHandoffUrl($order);
        $wa = zkcNotifyOrderConfirmed($pdo, $order);
        zkcNotifyLowStock($pdo, $low);
    }
    respond(['order_id' => $orderId, 'order_number' => $orderNumber, 'subtotal' => $subtotal, 'discount_amount' => $discount, 'gst_rate' => $gstRate,
        'gst_amount' => $gst, 'shipping_amount' => $shipping, 'total_amount' => $total, 'total' => $total, 'coupon_code' => $coupon ? $coupon['code'] : null,
        'next' => $payMethod === 'cod' ? 'confirmed' : 'razorpay_checkout', 'whatsapp' => $wa, 'whatsapp_handoff_url' => $handoff], 201);
}

if (preg_match('#^notify/[^/]+/(contact|notify)$#', $route, $m) && $method === 'POST') {
    $insert = $pdo->prepare('INSERT INTO inquiries (store_id, kind, name, email, phone, message) VALUES (?,?,?,?,?,?)');
    $insert->execute([STORE_ID, $m[1], $body['name'] ?? null, $body['email'] ?? null, $body['phone'] ?? null, $body['message'] ?? ($body['product_label'] ?? null)]);
    respond(['ok' => true]);
}

// ── Razorpay ─────────────────────────────────────────────
function razorpayRequest($httpMethod, $path, $payload = null) {
    $id = defined('RAZORPAY_KEY_ID') ? RAZORPAY_KEY_ID : '';
    $secret = defined('RAZORPAY_KEY_SECRET') ? RAZORPAY_KEY_SECRET : '';
    if ($id === '' || $secret === '') respond(['error' => 'Online payment is not configured. Add Razorpay keys to payment_config.php.'], 503);
    if (!function_exists('curl_init')) respond(['error' => 'The PHP curl extension is required for online payment.'], 503);
    $ch = curl_init('https://api.razorpay.com/v1/' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => $id . ':' . $secret, CURLOPT_TIMEOUT => 25, CURLOPT_CUSTOMREQUEST => $httpMethod, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    $data = json_decode((string)$raw, true);
    if ($raw === false || $status >= 400 || !is_array($data)) respond(['error' => 'Razorpay: ' . (($data['error']['description'] ?? '') ?: ($curlError ?: 'request failed (HTTP ' . $status . ')'))], 502);
    return $data;
}
function paise($amount) { return (int)round((float)$amount * 100); }

/** Give a coupon use back when an unpaid order's payment fails. */
function zkcReleaseCoupon($pdo, $code) {
    if ($code) $pdo->prepare('UPDATE coupons SET used_count = GREATEST(0, used_count - 1) WHERE store_id = ? AND UPPER(code) = UPPER(?)')->execute([STORE_ID, $code]);
}

// Razorpay → this site (Dashboard → Webhooks: https://<domain>/api.php?route=payments/razorpay/webhook, events payment.captured + payment.failed).
// Covers shoppers who close the tab before the browser reports the payment.
if ($route === 'payments/razorpay/webhook' && $method === 'POST') {
    $secret = defined('RAZORPAY_WEBHOOK_SECRET') ? RAZORPAY_WEBHOOK_SECRET : '';
    if ($secret === '') respond(['error' => 'Razorpay webhook secret is not configured'], 503);
    $sig = (string)($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/i', $sig) || !hash_equals(hash_hmac('sha256', (string)$raw, $secret), strtolower($sig))) respond(['error' => 'Invalid webhook signature'], 400);
    $event = json_decode((string)$raw, true) ?: [];
    $payment = $event['payload']['payment']['entity'] ?? [];
    $rzpOrder = (string)($payment['order_id'] ?? '');
    if ($rzpOrder !== '') {
        $stmt = $pdo->prepare('SELECT id, total_amount, coupon_code FROM orders WHERE store_id = ? AND razorpay_order_id = ?');
        $stmt->execute([STORE_ID, $rzpOrder]);
        $o = $stmt->fetch();
        if ($o && ($event['event'] ?? '') === 'payment.captured' && (int)($payment['amount'] ?? 0) === paise($o['total_amount'])) {
            // Only the request that flips the order to paid takes stock and sends messages.
            if (zkcMarkPaid($pdo, $o['id'], (string)($payment['id'] ?? ''))) zkcAfterPaid($pdo, $o['id']);
        } elseif ($o && ($event['event'] ?? '') === 'payment.failed') {
            $stmt = $pdo->prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'processing' AND order_status = 'pending'");
            $stmt->execute([$o['id']]);
            if ($stmt->rowCount()) zkcReleaseCoupon($pdo, $o['coupon_code']);
        }
    }
    respond(['status' => 'ok']);
}

if (preg_match('#^payments/#', $route) && !CHECKOUT_RAZORPAY) respond(['error' => 'Online payment is not available for this store.'], 400);

if ($route === 'payments/razorpay/order' && $method === 'POST') {
    $stmt = $pdo->prepare("SELECT id, order_number, total_amount, payment_status FROM orders WHERE id = ? AND store_id = ? AND payment_method = 'razorpay'");
    $stmt->execute([(int)($body['order_id'] ?? 0), STORE_ID]);
    $order = $stmt->fetch();
    if (!$order) respond(['error' => 'Order not found'], 404);
    if (!in_array($order['payment_status'], ['unpaid', 'failed'], true)) respond(['error' => 'This payment has already started or finished. Please place the order again.'], 409);
    $rzp = razorpayRequest('POST', 'orders', ['amount' => paise($order['total_amount']), 'currency' => 'INR', 'receipt' => $order['order_number'], 'notes' => ['order_id' => (string)$order['id']]]);
    $pdo->prepare("UPDATE orders SET razorpay_order_id = ?, payment_status = 'processing' WHERE id = ?")->execute([$rzp['id'], $order['id']]);
    respond(['razorpay_order_id' => $rzp['id'], 'amount' => $rzp['amount'], 'currency' => 'INR', 'key' => RAZORPAY_KEY_ID]);
}

if ($route === 'payments/razorpay/verify' && $method === 'POST') {
    $rzpOrderId = (string)($body['razorpay_order_id'] ?? '');
    $paymentId  = (string)($body['razorpay_payment_id'] ?? '');
    $signature  = (string)($body['razorpay_signature'] ?? '');
    if ($rzpOrderId === '' || $paymentId === '' || !defined('RAZORPAY_KEY_SECRET')) respond(['error' => 'Payment verification details are incomplete'], 400);
    if (!hash_equals(hash_hmac('sha256', $rzpOrderId . '|' . $paymentId, RAZORPAY_KEY_SECRET), $signature)) respond(['error' => 'Invalid payment signature'], 400);
    $stmt = $pdo->prepare("SELECT id, total_amount, payment_status FROM orders WHERE id = ? AND store_id = ? AND razorpay_order_id = ?");
    $stmt->execute([(int)($body['order_id'] ?? 0), STORE_ID, $rzpOrderId]);
    $order = $stmt->fetch();
    if (!$order) respond(['error' => 'Pending order not found for this payment'], 404);
    if ($order['payment_status'] === 'paid') respond(['message' => 'Payment already verified', 'order_id' => (int)$order['id'], 'whatsapp_handoff_url' => zkcHandoffUrl(zkcOrderById($pdo, $order['id']) ?: [])]);
    $payment = razorpayRequest('GET', 'payments/' . rawurlencode($paymentId));
    if (($payment['order_id'] ?? '') !== $rzpOrderId || (int)($payment['amount'] ?? 0) !== paise($order['total_amount']) || ($payment['currency'] ?? '') !== 'INR') respond(['error' => 'Payment does not match the order amount'], 400);
    if (($payment['status'] ?? '') !== 'captured') respond(['error' => 'Payment is not captured yet. Please retry or contact the store.'], 409);
    if (zkcMarkPaid($pdo, $order['id'], $paymentId)) zkcAfterPaid($pdo, $order['id']);
    respond(['message' => 'Payment verified', 'order_id' => (int)$order['id'], 'whatsapp_handoff_url' => zkcHandoffUrl(zkcOrderById($pdo, $order['id']) ?: [])]);
}

if ($route === 'payments/razorpay/failure' && $method === 'POST') {
    $stmt = $pdo->prepare("SELECT id, coupon_code FROM orders WHERE id = ? AND store_id = ? AND razorpay_order_id = ? AND payment_status = 'processing'");
    $stmt->execute([(int)($body['order_id'] ?? 0), STORE_ID, (string)($body['razorpay_order_id'] ?? '')]);
    if ($o = $stmt->fetch()) {
        $pdo->prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'processing'")->execute([$o['id']]);
        zkcReleaseCoupon($pdo, $o['coupon_code']);
    }
    respond(['recorded' => true, 'retryable' => true]);
}

respond(['error' => 'Route not found', 'route' => $route], 404);
