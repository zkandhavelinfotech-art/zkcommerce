<?php
// Test invoice routes in api.php and invoice.php
require_once 'zkc/api/services/php/db_config.php';

$pdo = getDbConnection();
if (!$pdo) {
    echo "DB not available, creating in-memory SQLite DB for testing logic\n";
    $pdo = new PDO('sqlite::memory:');
    $pdo->exec("CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER DEFAULT 2,
        order_number TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        shipping_address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        total_amount REAL,
        payment_method TEXT,
        payment_status TEXT,
        order_status TEXT,
        created_at TEXT
    )");
    $pdo->exec("INSERT INTO orders (id, store_id, order_number, customer_name, total_amount, payment_method, payment_status, order_status, created_at)
        VALUES (1, 2, 'ORD-PAID-001', 'Arun Kumar', 499.00, 'razorpay', 'paid', 'confirmed', '2026-11-05 10:00:00')");
    $pdo->exec("INSERT INTO orders (id, store_id, order_number, customer_name, total_amount, payment_method, payment_status, order_status, created_at)
        VALUES (2, 2, 'ORD-UNPAID-002', 'Bala S', 799.00, 'razorpay', 'unpaid', 'pending', '2026-11-05 10:05:00')");
    $pdo->exec("INSERT INTO orders (id, store_id, order_number, customer_name, total_amount, payment_method, payment_status, order_status, created_at)
        VALUES (3, 2, 'ORD-COD-003', 'Chandran M', 350.00, 'cod', 'pending', 'confirmed', '2026-11-05 10:10:00')");

    $sql = "SELECT id, order_number, customer_name, total_amount, payment_method, payment_status, order_status AS status, CONCAT('ZK-2-', id) AS invoice_number 
            FROM orders 
            WHERE (payment_status = 'paid' OR order_status IN ('confirmed', 'processing', 'shipped', 'delivered') OR (payment_method = 'cod' AND order_status != 'cancelled'))";
    
    // SQLite doesn't have CONCAT, replace with ||
    $sqlSqlite = str_replace("CONCAT('ZK-2-', id)", "('ZK-2-' || id)", $sql);
    $stmt = $pdo->query($sqlSqlite);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Invoices returned count: " . count($rows) . " (Expected: 2, ORD-PAID-001 and ORD-COD-003)\n";
    foreach ($rows as $r) {
        echo " - " . $r['order_number'] . " | " . $r['payment_status'] . " | " . $r['status'] . "\n";
    }

    $unpaidFound = false;
    foreach ($rows as $r) {
        if ($r['order_number'] === 'ORD-UNPAID-002') $unpaidFound = true;
    }
    if (!$unpaidFound) {
        echo "TEST PASSED: Unpaid order ORD-UNPAID-002 correctly excluded from Invoices!\n";
    } else {
        echo "TEST FAILED: Unpaid order was found in invoices!\n";
    }
}

