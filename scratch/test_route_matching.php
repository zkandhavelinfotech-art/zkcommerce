<?php
// Test route matching for invoices in api.php
$routes = [
    'invoices/12/pdf' => ['expected_id' => 12, 'type' => 'pdf'],
    'invoices/999/pdf' => ['expected_id' => 999, 'type' => 'pdf'],
    'invoices/45' => ['expected_id' => 45, 'type' => 'detail'],
    'invoices' => ['expected_id' => null, 'type' => 'list']
];

foreach ($routes as $route => $info) {
    if (preg_match('#^invoices/(\d+)/pdf$#', $route, $m)) {
        $orderId = (int)$m[1];
        assert($orderId === $info['expected_id']);
        echo "MATCHED PDF: route='$route' -> orderId=$orderId (OK)\n";
    } elseif (preg_match('#^invoices/(\d+)$#', $route, $m)) {
        $orderId = (int)$m[1];
        assert($orderId === $info['expected_id']);
        echo "MATCHED DETAIL: route='$route' -> orderId=$orderId (OK)\n";
    } elseif ($route === 'invoices') {
        echo "MATCHED LIST: route='$route' (OK)\n";
    } else {
        echo "FAILED TO MATCH: $route\n";
    }
}

// Test validation logic
$orders = [
    ['id' => 1, 'payment_status' => 'paid', 'order_status' => 'confirmed', 'payment_method' => 'razorpay'],
    ['id' => 2, 'payment_status' => 'unpaid', 'order_status' => 'pending', 'payment_method' => 'razorpay'],
    ['id' => 3, 'payment_status' => 'pending', 'order_status' => 'confirmed', 'payment_method' => 'cod'],
    ['id' => 4, 'payment_status' => 'failed', 'order_status' => 'cancelled', 'payment_method' => 'razorpay'],
];

echo "\nTesting paid validation logic:\n";
foreach ($orders as $o) {
    $payStatus = strtolower((string)($o['payment_status'] ?? ''));
    $ordStatus = strtolower((string)($o['order_status'] ?? ''));
    $payMethod = strtolower((string)($o['payment_method'] ?? ''));
    $isPaidOrConfirmed = ($payStatus === 'paid' || in_array($ordStatus, ['confirmed', 'processing', 'shipped', 'delivered']) || ($payMethod === 'cod' && $ordStatus !== 'cancelled'));
    
    echo "Order #{$o['id']} ({$o['payment_method']}, {$o['payment_status']}, {$o['order_status']}) -> Invoices Allowed: " . ($isPaidOrConfirmed ? "YES" : "NO") . "\n";
}

