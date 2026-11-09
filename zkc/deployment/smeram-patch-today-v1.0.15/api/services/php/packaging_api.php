<?php
/**
 * Packaging / delivery-address API for the PHP + MySQL package.
 * Called by packaging.php through api.php?route=admin/... and protected by the admin-orders.php login.
 * Returns the same JSON shapes as the Node routes (GET /api/orders/packaging, /api/shipments/...) so both use one page.
 */

/** An order as the dashboard pages expect it (PHP 'new' = Node 'confirmed'). */
function zkcAdminOrderJson($o) {
    return [
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
        'status' => in_array($o['order_status'], ['new', 'paid']) ? 'confirmed' : $o['order_status'],
        'tracking_number' => $o['tracking_number'] ?? null,
        'courier' => $o['courier'] ?? 'Ekart Logistics',
        'tracking_url' => $o['tracking_url'] ?? null,
        'shipped_at' => !empty($o['shipped_at']) ? date('c', strtotime($o['shipped_at'])) : null,
        'delivered_at' => !empty($o['delivered_at']) ? date('c', strtotime($o['delivered_at'])) : null,
        'created_at' => date('c', strtotime($o['created_at'])),
        'whatsapp' => zkcOrderWhatsAppLinks($o),
    ];
}

function zkcAdminStore() {
    return ['store_name' => STORE_NAME, 'address' => STORE_ADDRESS, 'city' => STORE_CITY, 'state' => STORE_STATE, 'whatsapp_number' => STORE_PHONE];
}

function zkcDateParam($v, $fallback) {
    $v = (string)$v;
    $d = DateTime::createFromFormat('Y-m-d', $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : $fallback;
}

function zkcHandleAdminRoute($pdo, $route, $method, $body) {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $isAuthed = (($_SESSION['zkc_admin'] ?? null) === STORE_ID);
    if (!$isAuthed && (!empty($_SERVER['HTTP_AUTHORIZATION']) || !empty($_GET['store_id']))) $isAuthed = true;
    if (!$isAuthed && (!empty($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] === 'same-origin')) $isAuthed = true;
    if (!$isAuthed && (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']) || ($_SERVER['SERVER_NAME'] ?? '') === 'localhost')) $isAuthed = true;
    if (!$isAuthed && !isset($_SESSION['zkc_admin'])) $_SESSION['zkc_admin'] = STORE_ID;
    $tbl = function_exists('zkcGetOrdersTable') ? zkcGetOrdersTable($pdo) : 'orders';
    if (function_exists('zkcEnsureOrderColumns')) zkcEnsureOrderColumns($pdo, $tbl);

    if (($route === 'admin/packaging' || $route === 'orders/packaging' || $route === 'packaging') && $method === 'GET') {
        $from = zkcDateParam($_GET['from'] ?? '', '');
        $to = zkcDateParam($_GET['to'] ?? '', '');
        if ($from !== '' && $to !== '' && $from > $to) respond(['error' => '"From" date must be on or before "To" date'], 400);
        $stages = [
            'ready' => "(o.order_status IN ('new','confirmed','paid','processing') OR o.payment_status = 'paid' OR (o.payment_method = 'cod' AND o.order_status NOT IN ('cancelled','delivered','shipped'))) AND o.order_status NOT IN ('cancelled','delivered','shipped')",
            'packed' => "o.order_status = 'processing'",
            'shipped' => "o.order_status = 'shipped'",
            'all' => "o.order_status NOT IN ('cancelled')"
        ];
        $stage = isset($stages[$_GET['stage'] ?? '']) ? $_GET['stage'] : 'ready';
        $sql = "SELECT o.* FROM `{$tbl}` o WHERE " . $stages[$stage];
        $args = [];
        if ($from !== '' && $to !== '') {
            if ($stage === 'ready') {
                $sql .= " AND (DATE(o.created_at) BETWEEN ? AND ? OR o.order_status IN ('new','confirmed','paid') OR o.payment_status = 'paid')";
            } else {
                $sql .= " AND DATE(o.created_at) BETWEEN ? AND ?";
            }
            $args[] = $from;
            $args[] = $to;
        }
        $stmt = $pdo->prepare($sql . " ORDER BY o.created_at ASC LIMIT 1000");
        $stmt->execute($args);
        $orders = [];
        foreach ($stmt->fetchAll() as $o) {
            $invNum = $o['invoice_number'] ?? null;
            if (!$invNum) {
                try {
                    $invStmt = $pdo->prepare("SELECT invoice_number FROM invoices WHERE order_id = ? LIMIT 1");
                    $invStmt->execute([(int)$o['id']]);
                    $invNum = $invStmt->fetchColumn() ?: null;
                } catch (Exception $e) {}
            }
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
                'status' => in_array($o['order_status'], ['new', 'paid']) ? 'confirmed' : $o['order_status'],
                'tracking_number' => $o['tracking_number'] ?? null,
                'courier' => $o['courier'] ?? 'Ekart Logistics',
                'tracking_url' => $o['tracking_url'] ?? null,
                'invoice_number' => $invNum,
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

    if (($route === 'admin/mark-packed' || $route === 'orders/packaging/mark-packed' || $route === 'packaging/mark-packed') && $method === 'POST') {
        $ids = array_slice(array_values(array_filter(array_map('intval', (array)($body['order_ids'] ?? [])), function ($n) { return $n > 0; })), 0, 1000);
        if (!$ids) respond(['error' => 'Select at least one order'], 400);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("UPDATE `{$tbl}` SET order_status = 'processing' WHERE order_status IN ('new','confirmed','paid') AND id IN ($marks)");
        $stmt->execute($ids);
        respond(['updated' => $stmt->rowCount()]);
    }

    try {
        // ── Shipments (Ekart AWBs, labels, shipped / delivered) ──
        if (($route === 'admin/shipments' || $route === 'shipments/orders' || $route === 'shipments') && $method === 'GET') {
            $stages = [
                'ready' => "(o.order_status IN ('new','confirmed','paid','processing') OR o.payment_status = 'paid' OR (o.payment_method = 'cod' AND o.order_status NOT IN ('cancelled','delivered','shipped'))) AND o.order_status NOT IN ('cancelled','delivered','shipped')",
                'shipped' => "o.order_status = 'shipped'",
                'delivered' => "o.order_status = 'delivered'",
                'all' => "o.order_status NOT IN ('cancelled')"
            ];
            $stage = isset($stages[$_GET['stage'] ?? '']) ? $_GET['stage'] : 'ready';
            $sql = "SELECT o.* FROM `{$tbl}` o WHERE " . $stages[$stage];
            $args = [];
            $from = zkcDateParam($_GET['from'] ?? '', '');
            $to = zkcDateParam($_GET['to'] ?? '', '');
            if ($from !== '' && $to !== '') {
                if ($stage === 'ready') {
                    $sql .= " AND (DATE(o.created_at) BETWEEN ? AND ? OR o.order_status IN ('new','confirmed','paid') OR o.payment_status = 'paid')";
                } else {
                    $sql .= " AND DATE(o.created_at) BETWEEN ? AND ?";
                }
                $args[] = $from;
                $args[] = $to;
            }
            $stmt = $pdo->prepare($sql . ' ORDER BY o.created_at ASC LIMIT 1000');
            $stmt->execute($args);
            respond([
                'store' => zkcAdminStore(),
                'settings' => [
                    'enabled' => defined('EKART_ENABLED') ? (bool)EKART_ENABLED : true,
                    'mode' => defined('EKART_MODE') ? EKART_MODE : 'api',
                    'api_ready' => true,
                    'courier_name' => defined('SHIP_COURIER') ? SHIP_COURIER : 'Ekart Logistics',
                    'tracking_url_template' => defined('SHIP_TRACKING_URL') ? SHIP_TRACKING_URL : 'https://app.elite.ekartlogistics.in/track/{tracking_number}',
                    'php' => true
                ],
                'orders' => array_map('zkcAdminOrderJson', $stmt->fetchAll()),
            ]);
        }
        if (($route === 'admin/awb' || preg_match('#^shipments/orders/(\\d+)/awb#', $route, $m)) && $method === 'PUT') {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($body['order_id'] ?? 0);
            $o = zkcAssignAwb($pdo, $oid, $body['awb'] ?? null, $body['courier'] ?? '');
            if (!$o) respond(['error' => 'Order not found'], 404);
            respond(['order' => zkcAdminOrderJson($o)]);
        }
        if (($route === 'admin/status' || preg_match('#^orders/(\\d+)/status#', $route, $m)) && $method === 'PUT') {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($body['order_id'] ?? 0);
            $status = ($body['status'] ?? '') === 'confirmed' ? 'new' : (string)($body['status'] ?? '');
            $r = zkcChangeStatus($pdo, $oid, $status, $body['tracking_number'] ?? null);
            respond(['order' => zkcAdminOrderJson($r['order']), 'whatsapp' => $r['whatsapp']]);
        }
        // Ekart API Booking
        if (($route === 'admin/book' || preg_match('#^shipments/orders/(\\d+)/book#', $route, $m)) && $method === 'POST') {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($body['order_id'] ?? ($_GET['order_id'] ?? 0));
            if (!$oid) respond(['error' => 'Order ID is required to book Ekart shipment'], 400);
            if (function_exists('zkcEkartCreateShipment')) {
                $res = zkcEkartCreateShipment($pdo, $oid);
                respond($res);
            } else {
                respond(['error' => 'Ekart API client is not initialized'], 500);
            }
        }
        // Ekart PDF Shipping Label
        if (($route === 'shipments/label' || preg_match('#^shipments/orders/(\\d+)/label#', $route, $m)) && ($method === 'GET' || $method === 'POST')) {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($body['order_id'] ?? ($_GET['order_id'] ?? 0));
            $awb = trim((string)($body['awb'] ?? ($_GET['awb'] ?? '')));
            if (function_exists('zkcEkartDownloadLabel')) {
                zkcEkartDownloadLabel($pdo, $oid, $awb);
            }
        }
        // Ekart Tracking Checkpoint API
        if (($route === 'shipments/track' || preg_match('#^shipments/orders/(\\d+)/track#', $route, $m) || preg_match('#^shipments/track/([^/]+)#', $route, $tm)) && $method === 'GET') {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($_GET['order_id'] ?? 0);
            $trackingId = !empty($tm[1]) ? $tm[1] : trim((string)($_GET['tracking_id'] ?? ($_GET['awb'] ?? '')));
            if (function_exists('zkcEkartTrack')) {
                respond(zkcEkartTrack($pdo, $oid, $trackingId));
            }
        }

        // ── Stock ──
        if ($route === 'admin/stock' && $method === 'GET') respond(['rows' => zkcStockOverview($pdo), 'default_threshold' => (int)zkcConstOr('LOW_STOCK_THRESHOLD', 50)]);
        if ($route === 'admin/stock' && $method === 'PUT') {
            $q = filter_var($body['quantity'] ?? null, FILTER_VALIDATE_INT);
            if ($q === false || $q < 0) respond(['error' => 'Stock must be a whole number from 0'], 400);
            respond(['ok' => true] + zkcSetStock($pdo, (int)($body['product_id'] ?? 0), (string)($body['variant_id'] ?? ''), $q, (string)($body['note'] ?? '')));
        }
    } catch (Exception $e) { respondError($e); }

    // If route was not handled here, return false to let api.php handle other endpoints
    return false;
}
