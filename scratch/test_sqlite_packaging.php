<?php
// Test packaging_api with SQLite in-memory PDO
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Create orders table
$pdo->exec("CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    shipping_address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    items_json TEXT,
    total_amount REAL,
    payment_method TEXT,
    payment_status TEXT,
    order_status TEXT,
    tracking_number TEXT,
    courier TEXT,
    tracking_url TEXT,
    shipped_at TEXT,
    delivered_at TEXT,
    created_at TEXT
)");

// Insert order ORD-261103-A35B0F
$pdo->exec("INSERT INTO orders (
    order_number, customer_name, customer_phone, customer_email,
    shipping_address, city, state, pincode, items_json,
    total_amount, payment_method, payment_status, order_status, created_at
) VALUES (
    'ORD-261103-A35B0F', 'Suresh Kumar', '+91 98401 12345', 'suresh@example.com',
    'No 12, Main Road', 'Chennai', 'Tamil Nadu', '600001',
    '[{\"name\":\"Hair Oil\",\"quantity\":1,\"price\":299}]',
    299.00, 'online', 'paid', 'confirmed', '2026-11-03 14:30:00'
)");

define('STORE_NAME', 'Smeram Naturals');
define('STORE_ADDRESS', 'Chennai, Tamil Nadu');
define('STORE_CITY', 'Chennai');
define('STORE_STATE', 'Tamil Nadu');
define('STORE_PHONE', '+91 75399 72026');
define('STORE_ID', '2');

require __DIR__ . '/../zkc/api/services/php/commerce.php';
require __DIR__ . '/../zkc/api/services/php/packaging_api.php';

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['from'] = '2026-10-30';
$_GET['to'] = '2026-11-06';
$_GET['stage'] = 'ready';
$_GET['store_id'] = '2';

echo "Testing route: orders/packaging\n";
try {
    zkcHandleAdminRoute($pdo, 'orders/packaging', 'GET', []);
} catch (Exception $e) {
    echo "Caught: " . $e->getMessage() . "\n";
}
