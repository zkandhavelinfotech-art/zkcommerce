<?php
/**
 * Smeram Naturals — Order Receiver API for GoDaddy Windows Hosting
 * Saves orders directly into GoDaddy MySQL database.
 * Supports both 'orders' (standard schema) and 'smeram_orders' (client schema).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (is_file(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getOrdersTable($pdo) {
    try {
        $pdo->query("SELECT 1 FROM `orders` LIMIT 1");
        return 'orders';
    } catch (Exception $e) {}
    try {
        $pdo->query("SELECT 1 FROM `smeram_orders` LIMIT 1");
        return 'smeram_orders';
    } catch (Exception $e) {}
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `smeram_orders` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `order_number` VARCHAR(32) NOT NULL UNIQUE,
          `customer_name` VARCHAR(120) NOT NULL,
          `customer_phone` VARCHAR(20) NOT NULL,
          `customer_email` VARCHAR(120) NULL,
          `shipping_address` TEXT NOT NULL,
          `city` VARCHAR(60) NOT NULL,
          `state` VARCHAR(60) DEFAULT 'Tamil Nadu',
          `pincode` VARCHAR(10) NOT NULL,
          `items_json` TEXT NOT NULL,
          `subtotal` DECIMAL(10,2) NOT NULL,
          `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
          `shipping_amount` DECIMAL(10,2) DEFAULT 0.00,
          `total_amount` DECIMAL(10,2) NOT NULL,
          `payment_method` VARCHAR(30) DEFAULT 'cod',
          `payment_status` VARCHAR(30) DEFAULT 'pending',
          `order_status` VARCHAR(30) DEFAULT 'new',
          `razorpay_order_id` VARCHAR(64) NULL,
          `razorpay_payment_id` VARCHAR(64) NULL,
          `razorpay_signature` VARCHAR(255) NULL,
          `notes` TEXT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        return 'smeram_orders';
    } catch (Exception $e) {}
    return 'smeram_orders';
}

// Health / Connection Check: GET /order.php?ping=1
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['ping'])) {
    $pdo = function_exists('getDbConnection') ? getDbConnection() : null;
    if ($pdo) {
        $tbl = getOrdersTable($pdo);
        $totalOrders = 0;
        try {
            $stmt = $pdo->query("SELECT COUNT(*) AS total_orders FROM `{$tbl}`");
            $row = $stmt ? $stmt->fetch() : null;
            $totalOrders = (int)($row['total_orders'] ?? 0);
        } catch (Exception $e) {}
        echo json_encode([
            'status' => 'connected',
            'database' => defined('DB_NAME') ? DB_NAME : 'unknown',
            'table' => $tbl,
            'total_orders' => $totalOrders
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'status' => 'disconnected',
            'message' => 'Could not connect to GoDaddy MySQL. Check db_config.php'
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Send POST JSON.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode((string)$rawInput, true);

if (!$data) {
    $data = $_POST;
}

$name     = trim($data['customer_name'] ?? $data['name'] ?? '');
$phone    = trim($data['customer_phone'] ?? $data['phone'] ?? '');
$email    = trim($data['customer_email'] ?? $data['email'] ?? '');
$address  = trim($data['shipping_address'] ?? $data['address'] ?? '');
$city     = trim($data['city'] ?? '');
$state    = trim($data['state'] ?? 'Tamil Nadu');
$pincode  = trim($data['pincode'] ?? '');
$method   = trim($data['payment_method'] ?? 'cod');
$total    = floatval($data['total_amount'] ?? $data['grand_total'] ?? 0);
$discount = floatval($data['discount_amount'] ?? 0);
$shipping = floatval($data['shipping_amount'] ?? 0);
$items    = $data['items'] ?? [];
$notes    = trim($data['notes'] ?? '');

if (empty($name) || empty($phone) || empty($address)) {
    http_response_code(400);
    echo json_encode(['error' => 'Customer name, phone number, and delivery address are required.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$orderNum = !empty($data['order_number']) ? trim($data['order_number']) : 'SM-' . date('Ymd') . '-' . rand(1000, 9999);
$itemsJson = is_string($items) ? $items : json_encode($items, JSON_UNESCAPED_UNICODE);

$pdo = function_exists('getDbConnection') ? getDbConnection() : null;
$savedToDb = false;
$orderId = null;
$dbError = null;

if ($pdo) {
    try {
        $tbl = getOrdersTable($pdo);
        $subtotal = $total + $discount - $shipping;
        $payStatus = !empty($data['payment_status']) ? trim($data['payment_status']) : (($method === 'razorpay') ? 'paid' : 'pending');
        $rzpPaymentId = trim($data['razorpay_payment_id'] ?? '');
        $rzpOrderId = trim($data['razorpay_order_id'] ?? '');
        $rzpSig = trim($data['razorpay_signature'] ?? '');
        if ($rzpPaymentId !== '') {
            $notes = trim($notes . ' [Razorpay Payment ID: ' . $rzpPaymentId . ']');
        }

        $hasStoreId = true;
        try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }

        if ($hasStoreId) {
            $stmt = $pdo->prepare("
                INSERT INTO `{$tbl}` 
                (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, subtotal, discount_amount, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, notes)
                VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
            ");
            $stmt->execute([
                $orderNum, $name, $phone, $email, $address, $city, $state, $pincode, $itemsJson,
                $subtotal, $discount, $shipping, $total, $method, $payStatus,
                $rzpOrderId ?: null, $rzpPaymentId ?: null, $rzpSig ?: null, $notes
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO `{$tbl}` 
                (order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, subtotal, discount_amount, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
            ");
            $stmt->execute([
                $orderNum, $name, $phone, $email, $address, $city, $state, $pincode, $itemsJson,
                $subtotal, $discount, $shipping, $total, $method, $payStatus,
                $rzpOrderId ?: null, $rzpPaymentId ?: null, $rzpSig ?: null, $notes
            ]);
        }

        $orderId = $pdo->lastInsertId();
        $savedToDb = true;

        // Auto-generate invoice
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `smeram_invoices` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `order_id` INT NOT NULL UNIQUE,
                `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
                `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_inv_order` (`order_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $invNum = 'ZK-SMERAM-' . $orderId;
            $pdo->prepare("INSERT INTO `smeram_invoices` (`order_id`, `invoice_number`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `order_id`=`order_id`")
                ->execute([$orderId, $invNum]);
        } catch (Exception $invE) {}
    } catch (Exception $e) {
        $dbError = $e->getMessage();
        error_log("[Order Insert Error] " . $e->getMessage());
    }
}

echo json_encode([
    'success' => true,
    'order_id' => $orderId,
    'order_number' => $orderNum,
    'saved_to_mysql' => $savedToDb,
    'db_error' => $dbError,
    'message' => 'Order registered successfully!'
], JSON_UNESCAPED_UNICODE);
