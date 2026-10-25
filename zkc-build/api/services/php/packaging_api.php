<?php
/**
 * Packaging / delivery-address API for the PHP + MySQL package.
 * Called by packaging.php through api.php?route=admin/... and protected by the admin-orders.php login.
 * Returns the same JSON shape as the Node route GET /api/orders/packaging so both use one page.
 */

function zkcDateParam($v, $fallback) {
    $v = (string)$v;
    $d = DateTime::createFromFormat('Y-m-d', $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : $fallback;
}

function zkcHandleAdminRoute($pdo, $route, $method, $body) {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (($_SESSION['zkc_admin'] ?? null) !== STORE_ID) respond(['error' => 'Please sign in at admin-orders.php first.'], 401);

    if ($route === 'admin/packaging' && $method === 'GET') {
        $today = date('Y-m-d');
        $from = zkcDateParam($_GET['from'] ?? '', $today);
        $to = zkcDateParam($_GET['to'] ?? '', $from);
        if ($from > $to) respond(['error' => '"From" date must be on or before "To" date'], 400);
        $stages = ['ready' => "o.order_status = 'new'", 'packed' => "o.order_status = 'processing'", 'shipped' => "o.order_status = 'shipped'", 'all' => "o.order_status NOT IN ('pending','cancelled')"];
        $stage = isset($stages[$_GET['stage'] ?? '']) ? $_GET['stage'] : 'ready';
        $stmt = $pdo->prepare('SELECT o.* FROM orders o WHERE o.store_id = ? AND ' . $stages[$stage] . ' AND DATE(o.created_at) BETWEEN ? AND ? ORDER BY o.created_at ASC LIMIT 1000');
        $stmt->execute([STORE_ID, $from, $to]);
        $orders = [];
        foreach ($stmt->fetchAll() as $o) {
            $orders[] = [
                'id' => (int)$o['id'],
                'order_number' => $o['order_number'],
                'customer_name' => $o['customer_name'],
                'customer_phone' => $o['customer_phone'],
                'customer_email' => $o['customer_email'],
                'shipping_address' => ['line1' => $o['shipping_address'], 'city' => $o['city'], 'state' => $o['state'], 'pincode' => $o['pincode']],
                'items' => zkcOrderItems($o),
                'total_amount' => (float)$o['total_amount'],
                'payment_method' => $o['payment_method'],
                'payment_status' => $o['payment_status'],
                'status' => $o['order_status'],
                'tracking_number' => $o['tracking_number'] ?? null,
                'invoice_number' => null,
                'created_at' => date('c', strtotime($o['created_at'])),
                'whatsapp' => zkcOrderWhatsAppLinks($o),
            ];
        }
        respond([
            'from' => $from, 'to' => $to, 'stage' => $stage,
            'store' => ['store_name' => STORE_NAME, 'address' => STORE_ADDRESS, 'city' => STORE_CITY, 'state' => STORE_STATE, 'whatsapp_number' => STORE_PHONE],
            'care_label' => defined('WA_CARE_LABEL') ? WA_CARE_LABEL : 'Customer care',
            'orders' => $orders,
        ]);
    }

    if ($route === 'admin/mark-packed' && $method === 'POST') {
        $ids = array_slice(array_values(array_filter(array_map('intval', (array)($body['order_ids'] ?? [])), function ($n) { return $n > 0; })), 0, 1000);
        if (!$ids) respond(['error' => 'Select at least one order'], 400);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("UPDATE orders SET order_status = 'processing' WHERE store_id = ? AND order_status = 'new' AND id IN ($marks)");
        $stmt->execute(array_merge([STORE_ID], $ids));
        respond(['updated' => $stmt->rowCount()]);
    }

    respond(['error' => 'Route not found', 'route' => $route], 404);
}
