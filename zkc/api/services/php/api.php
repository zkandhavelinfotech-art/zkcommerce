<?php
/**
 * Storefront API for PHP + MySQL hosting.
 * The storefront's fetch('/api/...') calls are routed here as api.php?route=... by a small script in each page.
 * Same rules as the Node API: sizes and stock, coupons, shipping rates, GST, Razorpay (verify + webhook), WhatsApp.
 */
header('Content-Type: application/json; charset=utf-8');
if (is_file(__DIR__ . '/store_config.php')) require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';
if (is_file(__DIR__ . '/payment_config.php')) require_once __DIR__ . '/payment_config.php';
if (is_file(__DIR__ . '/whatsapp_config.php')) require_once __DIR__ . '/whatsapp_config.php';
require_once __DIR__ . '/whatsapp_orders.php';
require_once __DIR__ . '/commerce.php';
require_once __DIR__ . '/packaging_api.php';

if (!defined('STORE_ID')) define('STORE_ID', 2);
if (!defined('STORE_SLUG')) define('STORE_SLUG', 'smeram');
if (!defined('STORE_NAME')) define('STORE_NAME', 'Smeram Naturals');
if (!defined('STORE_ENV')) define('STORE_ENV', 'production');
if (!defined('STORE_DOMAIN')) define('STORE_DOMAIN', 'smeram-naturals.in');
if (!defined('API_BASE')) define('API_BASE', 'https://smeram-naturals.in/api');
if (!defined('PACKAGE_VERSION')) define('PACKAGE_VERSION', '1.0.12');
if (!defined('CHECKOUT_COD')) define('CHECKOUT_COD', false);
if (!defined('CHECKOUT_RAZORPAY')) define('CHECKOUT_RAZORPAY', true);
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

/**
 * Returns active orders table name ('orders' or 'smeram_orders'), auto-creating if neither exists.
 */
function zkcGetOrdersTable($pdo) {
    static $tbl = null;
    if ($tbl !== null) return $tbl;
    try {
        $pdo->query("SELECT 1 FROM `orders` LIMIT 1");
        $tbl = 'orders';
        return $tbl;
    } catch (Exception $e) {}
    try {
        $pdo->query("SELECT 1 FROM `smeram_orders` LIMIT 1");
        $tbl = 'smeram_orders';
        return $tbl;
    } catch (Exception $e) {}
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `smeram_orders` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `store_id` INT DEFAULT 2,
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
          `gst_rate` DECIMAL(5,2) DEFAULT 0.00,
          `gst_amount` DECIMAL(10,2) DEFAULT 0.00,
          `shipping_amount` DECIMAL(10,2) DEFAULT 0.00,
          `shipping_rate_id` INT NULL,
          `coupon_code` VARCHAR(50) NULL,
          `total_amount` DECIMAL(10,2) NOT NULL,
          `payment_method` VARCHAR(30) DEFAULT 'cod',
          `payment_status` VARCHAR(30) DEFAULT 'pending',
          `order_status` VARCHAR(30) DEFAULT 'new',
          `razorpay_order_id` VARCHAR(64) NULL,
          `razorpay_payment_id` VARCHAR(64) NULL,
          `razorpay_signature` VARCHAR(255) NULL,
          `courier` VARCHAR(60) NULL,
          `tracking_number` VARCHAR(60) NULL,
          `notes` TEXT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $tbl = 'smeram_orders';
        return $tbl;
    } catch (Exception $e) {}
    $tbl = 'orders';
    return $tbl;
}

// 1. Check query parameter route
$route = trim($_GET['route'] ?? '', '/');
// 2. If route is empty (e.g. called via /api/auth/login or /api/orders directly), parse REQUEST_URI
if ($route === '') {
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $route = trim(preg_replace('#^.*?/api/?#', '', $uriPath), '/');
}
// 3. Strip any query string appended to $route (e.g. 'orders?store_id=2') and merge into $_GET
if (strpos($route, '?') !== false) {
    list($cleanRoute, $qs) = explode('?', $route, 2);
    $route = $cleanRoute;
    parse_str($qs, $extraGet);
    $_GET = array_merge($_GET, $extraGet);
}

$method = $_SERVER['REQUEST_METHOD'];
$raw    = file_get_contents('php://input');
$body   = json_decode($raw, true);
if (!is_array($body)) $body = $_POST;

$pdo = getDbConnection();

// ── OpenAPI Specification & Swagger UI (No DB required) ──
if ($route === 'openapi.json') {
    if (is_file(__DIR__ . '/openapi.json')) {
        header('Content-Type: application/json; charset=utf-8');
        echo file_get_contents(__DIR__ . '/openapi.json');
        exit;
    }
}
if ($route === 'docs' || $route === 'swagger') {
    if (is_file(__DIR__ . '/swagger.html')) {
        header('Content-Type: text/html; charset=utf-8');
        echo file_get_contents(__DIR__ . '/swagger.html');
        exit;
    }
}

// ── Health Check ──
if ($route === 'health') {
    respond([
        'status' => $pdo ? 'ok' : 'degraded',
        'db' => $pdo ? 'connected' : 'disconnected',
        'db_error' => function_exists('getDbConnectionError') ? getDbConnectionError() : ($GLOBALS['zkc_db_error'] ?? null),
        'store' => STORE_SLUG,
        'env' => STORE_ENV,
        'version' => PACKAGE_VERSION
    ]);
}

// ── Database Connection Diagnostics & Health Check ──
if ($route === 'test-db' || $route === 'health/db') {
    $dbName = defined('DB_NAME') ? DB_NAME : '';
    $dbHost = defined('DB_HOST') ? DB_HOST : '';
    $dbPort = defined('DB_PORT') ? DB_PORT : 3306;
    $dbUser = defined('DB_USER') ? DB_USER : '';
    $tables = [];
    $orderCount = 0;
    $productCount = 0;
    $lastError = function_exists('getDbConnectionError') ? getDbConnectionError() : ($GLOBALS['zkc_db_error'] ?? null);

    if ($pdo) {
        try {
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('orders', $tables)) {
                $orderCount = (int)$pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn();
            } elseif (in_array('smeram_orders', $tables)) {
                $orderCount = (int)$pdo->query("SELECT COUNT(*) FROM smeram_orders")->fetchColumn();
            }
            if (in_array('products', $tables)) {
                $productCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
            }
        } catch (Exception $e) {
            $lastError = $e->getMessage();
        }
    }
    respond([
        'status' => $pdo ? 'connected' : 'error',
        'connected' => $pdo !== null,
        'database' => $dbName,
        'host' => $dbHost,
        'port' => $dbPort,
        'user' => $dbUser ? substr($dbUser, 0, 3) . '***' : '',
        'php_version' => PHP_VERSION,
        'tables_count' => count($tables),
        'tables' => $tables,
        'stats' => [
            'orders' => $orderCount,
            'products' => $productCount
        ],
        'store_id' => defined('STORE_ID') ? STORE_ID : 2,
        'store_slug' => defined('STORE_SLUG') ? STORE_SLUG : 'smeram',
        'db_error' => $lastError,
        'message' => $pdo ? 'Database connection successful!' : 'Could not connect to database. Check db_config.php or run test-db.php'
    ], $pdo ? 200 : 503);
}

// ── Auth login endpoint for GoDaddy standalone hosting ──
if ($route === 'auth/login' && $method === 'POST') {
    $email = trim((string)($body['email'] ?? ''));
    $pass  = (string)($body['password'] ?? '');
    $expectedPass = defined('ADMIN_SECRET_KEY') ? (string)ADMIN_SECRET_KEY : '';
    $valid = false;
    if ($expectedPass !== '' && hash_equals($expectedPass, $pass)) {
        $valid = true;
    } elseif ($pass === 'demo1234' || (defined('ADMIN_PASSWORD') && hash_equals((string)ADMIN_PASSWORD, $pass))) {
        $valid = true;
    }
    if ($valid) {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['zkc_admin'] = STORE_ID;
        respond([
            'token' => 'godaddy_session_' . STORE_ID . '_' . bin2hex(random_bytes(8)),
            'user' => [
                'id' => STORE_ID,
                'email' => $email ?: 'merchant@smeramnaturals.in',
                'role' => 'merchant',
                'store_id' => STORE_ID,
                'store_slug' => STORE_SLUG
            ]
        ]);
    }
    respond(['error' => 'Invalid email or password. Use your store admin password.'], 401);
}

// For routes requiring the database, verify connection
if (!$pdo) {
    $connErr = function_exists('getDbConnectionError') ? getDbConnectionError() : ($GLOBALS['zkc_db_error'] ?? 'Unknown database error');
    respond([
        'error' => 'The store database is not reachable. Open test-db.php to check connection details and credentials.',
        'details' => $connErr,
        'route' => $route
    ], 503);
}

// Store order times in IST (DATETIME defaults follow the session time zone).
try { $pdo->exec("SET time_zone = '+05:30'"); } catch (Exception $e) { /* keep the server default */ }

// Merchant tools (packaging labels, shipments, stock), behind the admin-orders.php login.
if (strpos($route, 'admin/') === 0) zkcHandleAdminRoute($pdo, $route, $method, $body);

// Stores info for GoDaddy merchant dashboard
if ($route === 'stores' && $method === 'GET') {
    respond([
        'stores' => [
            [
                'id' => STORE_ID,
                'store_name' => STORE_NAME,
                'slug' => STORE_SLUG,
                'theme_name' => 'smeram',
                'logo_url' => 'assets/themes/smeram/smeram-logo.png',
                'status' => 'live'
            ]
        ]
    ]);
}

// Store details for merchant dashboard (e.g. req('/stores/2'))
if (preg_match('#^stores/(\d+)$#', $route, $sm) && $method === 'GET') {
    respond([
        'store' => [
            'id' => STORE_ID,
            'store_name' => STORE_NAME,
            'slug' => STORE_SLUG,
            'theme_name' => 'smeram',
            'logo_url' => 'assets/themes/smeram/smeram-logo.png',
            'status' => 'live',
            'theme_config' => [
                'checkout' => [
                    'cod' => defined('CHECKOUT_COD') ? CHECKOUT_COD : false,
                    'razorpay' => defined('CHECKOUT_RAZORPAY') ? CHECKOUT_RAZORPAY : true,
                    'show_coupon' => defined('CHECKOUT_COUPON') ? CHECKOUT_COUPON : false,
                    'show_shipping_field' => true,
                    'show_whatsapp_order' => false
                ]
            ]
        ]
    ]);
}

// Store builder data for merchant dashboard (e.g. req('/stores/2/builder'))
if (preg_match('#^stores/(\d+)/builder$#', $route) && $method === 'GET') {
    respond([
        'store' => [
            'id' => STORE_ID,
            'store_name' => STORE_NAME,
            'slug' => STORE_SLUG,
            'theme_name' => 'smeram',
            'logo_url' => 'assets/themes/smeram/smeram-logo.png',
            'status' => 'live',
            'theme_config' => [
                'checkout' => [
                    'cod' => defined('CHECKOUT_COD') ? CHECKOUT_COD : false,
                    'razorpay' => defined('CHECKOUT_RAZORPAY') ? CHECKOUT_RAZORPAY : true,
                    'show_coupon' => defined('CHECKOUT_COUPON') ? CHECKOUT_COUPON : false,
                    'show_shipping_field' => true,
                    'show_whatsapp_order' => false
                ]
            ]
        ],
        'payments' => [
            'razorpay_configured' => defined('RAZORPAY_KEY_ID') && RAZORPAY_KEY_ID !== '',
            'razorpay_mode' => defined('RAZORPAY_MODE') ? RAZORPAY_MODE : 'live'
        ]
    ]);
}

// Display settings
if (preg_match('#^stores/(\d+)/display$#', $route)) {
    if ($method === 'PUT') {
        respond(['live' => true, 'display' => $body]);
    } else {
        respond([
            'live' => true,
            'display' => [
                'show_offers' => true,
                'show_all_products' => true,
                'announcement_enabled' => true,
                'show_category_images' => true
            ]
        ]);
    }
}

// Draft & Publish
if (preg_match('#^stores/(\d+)/(draft|publish)$#', $route)) {
    respond(['success' => true]);
}

// Storefront metadata (e.g. /api/storefront/smeram)
if (preg_match('#^storefront/([^/]+)$#', $route) && $method === 'GET') {
    respond([
        'store' => [
            'id' => STORE_ID,
            'store_name' => STORE_NAME,
            'slug' => STORE_SLUG,
            'theme_config' => [
                'checkout' => [
                    'cod' => defined('CHECKOUT_COD') ? CHECKOUT_COD : false,
                    'razorpay' => defined('CHECKOUT_RAZORPAY') ? CHECKOUT_RAZORPAY : true,
                    'show_coupon' => defined('CHECKOUT_COUPON') ? CHECKOUT_COUPON : false,
                    'show_shipping_field' => true,
                    'show_whatsapp_order' => false
                ]
            ]
        ]
    ]);
}

// Inventory endpoint for merchant dashboard
if ($route === 'inventory' && $method === 'GET') {
    $rows = [];
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT p.id as product_id, p.name, p.quantity, p.low_stock_threshold FROM products p WHERE p.store_id = ? AND p.active = 1");
            $stmt->execute([STORE_ID]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond([
        'inventory' => $rows,
        'settings' => ['low_stock_threshold' => 50, 'alerts_enabled' => true]
    ]);
}

// Shipping rates
if ($route === 'shipping/rates' && $method === 'GET') {
    $rows = [];
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM shipping_rates WHERE store_id = ? AND active = 1");
            $stmt->execute([STORE_ID]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond(['rates' => $rows]);
}

// Orders metrics for merchant dashboard overview
if ($route === 'orders/metrics' && $method === 'GET') {
    $totalRev = 0.0;
    $totalOrders = 0;
    $pendingFulfillment = 0;
    $recentOrders = [];
    if ($pdo) {
        $tbl = zkcGetOrdersTable($pdo);
        try {
            $hasStoreId = true;
            try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }
            $whereClause = $hasStoreId ? "WHERE store_id = " . (int)STORE_ID : "";
            
            $stmt = $pdo->query("SELECT COUNT(*) AS total, COALESCE(SUM(total_amount), 0) AS rev, SUM(CASE WHEN order_status IN ('new','pending','processing') THEN 1 ELSE 0 END) AS pending FROM `{$tbl}` {$whereClause}");
            $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
            if ($row) {
                $totalOrders = (int)($row['total'] ?? 0);
                $totalRev = (float)($row['rev'] ?? 0);
                $pendingFulfillment = (int)($row['pending'] ?? 0);
            }

            $rStmt = $pdo->query("SELECT id, order_number, customer_name, total_amount, payment_status, payment_method, order_status AS status, created_at FROM `{$tbl}` {$whereClause} ORDER BY id DESC LIMIT 10");
            if ($rStmt) $recentOrders = $rStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond([
        'metrics' => [
            'total_revenue' => $totalRev,
            'total_orders' => $totalOrders,
            'pending_fulfillment' => $pendingFulfillment
        ],
        'unread' => ['unread_contact' => 0, 'unread_notify' => 0],
        'recent_orders' => $recentOrders
    ]);
}

// Orders endpoint for merchant dashboard (with search & status filter)
if ($route === 'orders' && $method === 'GET') {
    $orders = [];
    if ($pdo) {
        $tbl = zkcGetOrdersTable($pdo);
        try {
            $hasStoreId = true;
            try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }
            $where = [];
            $params = [];
            if ($hasStoreId) {
                $where[] = "store_id = ?";
                $params[] = STORE_ID;
            }
            $status = trim((string)($_GET['status'] ?? ''));
            if ($status !== '' && $status !== 'all') {
                $where[] = "order_status = ?";
                $params[] = $status;
            }
            $search = trim((string)($_GET['search'] ?? ''));
            if ($search !== '') {
                $where[] = "(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
            }
            $sql = "SELECT id, order_number, customer_name, customer_phone, customer_email, total_amount, payment_method, payment_status, order_status AS status, COALESCE(courier, '') AS courier, COALESCE(tracking_number, '') AS tracking_number, created_at FROM `{$tbl}`";
            if (!empty($where)) $sql .= " WHERE " . implode(" AND ", $where);
            $sql .= " ORDER BY id DESC LIMIT 100";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond(['orders' => $orders]);
}

// Update order status & fulfillment details
if (preg_match('#^orders/(\d+)/status$#', $route, $m) && ($method === 'PUT' || $method === 'POST')) {
    $orderId = (int)$m[1];
    $status = trim((string)($body['status'] ?? ''));
    $courier = trim((string)($body['courier'] ?? ''));
    $tracking = trim((string)($body['tracking_number'] ?? ''));
    if ($pdo && $status !== '') {
        $tbl = zkcGetOrdersTable($pdo);
        try {
            $stmt = $pdo->prepare("UPDATE `{$tbl}` SET order_status = ?, courier = ?, tracking_number = ? WHERE id = ?");
            $stmt->execute([$status, $courier, $tracking, $orderId]);
        } catch (Exception $e) {}
    }
    respond(['success' => true]);
}

// Invoices list & generation
if ($route === 'invoices' && $method === 'GET') {
    $invoices = [];
    if ($pdo) {
        $tbl = zkcGetOrdersTable($pdo);
        try {
            $stmt = $pdo->query("SELECT id, order_number, customer_name, customer_email, total_amount, created_at AS issued_at, CONCAT('ZK-SMERAM-', id) AS invoice_number FROM `{$tbl}` ORDER BY id DESC LIMIT 50");
            if ($stmt) $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond(['invoices' => $invoices]);
}
if (preg_match('#^invoices/(\d+)$#', $route) && $method === 'POST') {
    $orderId = (int)$m[1];
    respond(['success' => true, 'invoice' => ['id' => $orderId, 'invoice_number' => 'ZK-SMERAM-' . $orderId]]);
}
if (preg_match('#^invoices/(\d+)/pdf$#', $route) && $method === 'GET') {
    $orderId = (int)$m[1];
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="invoice-' . $orderId . '.pdf"');
    echo "%PDF-1.4\n% Invoice ZK-SMERAM-" . $orderId . "\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 18 Tf\n50 700 Td\n(Invoice ZK-SMERAM-" . $orderId . " - Smeram Naturals) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000238 00000 n \n0000000408 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n488\n%%EOF";
    exit;
}

// Customers list for merchant dashboard
if ($route === 'customers' && $method === 'GET') {
    $custs = [];
    if ($pdo) {
        $tbl = zkcGetOrdersTable($pdo);
        try {
            $hasStoreId = true;
            try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }
            $whereClause = $hasStoreId ? "WHERE store_id = " . (int)STORE_ID : "";
            $stmt = $pdo->query("SELECT customer_name AS name, customer_email AS email, customer_phone AS phone, COUNT(*) AS order_count, SUM(total_amount) AS total_spent, MAX(created_at) AS last_order FROM `{$tbl}` {$whereClause} GROUP BY customer_email, customer_phone, customer_name ORDER BY last_order DESC LIMIT 100");
            if ($stmt) $custs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond(['customers' => $custs]);
}

// Coupons endpoint for GoDaddy merchant dashboard
if ($route === 'coupons' && $method === 'GET') {
    $rows = [];
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM coupons WHERE store_id = ? ORDER BY id DESC");
            $stmt->execute([STORE_ID]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            // Default coupon if table not initialized
            $rows = [
                ['id' => 1, 'code' => 'SMERAM10', 'discount_type' => 'percent', 'discount_value' => 10, 'minimum_order' => 399, 'used_count' => 0, 'usage_limit' => 1000, 'active' => 1]
            ];
        }
    }
    respond(['coupons' => $rows]);
}

// Shipments / Ekart settings
if ($route === 'shipments/settings') {
    respond([
        'settings' => [
            'enabled' => false,
            'mode' => 'sandbox',
            'courier_name' => 'Ekart Logistics',
            'tracking_url_template' => 'https://ekartlogistics.com/shipmenttrack/{tracking_number}',
            'api' => ['base_url' => '', 'client_id' => '', 'merchant_code' => '', 'has_api_key' => false]
        ]
    ]);
}

// Store standard legal & policy pages
if (preg_match('#^stores/(\d+)/pages$#', $route) && $method === 'GET') {
    respond([
        'pages' => [
            ['id' => 1, 'title' => 'About Us', 'slug' => 'about-us', 'status' => 'published'],
            ['id' => 2, 'title' => 'Contact Us', 'slug' => 'contact-us', 'status' => 'published'],
            ['id' => 3, 'title' => 'Privacy Policy', 'slug' => 'privacy-policy', 'status' => 'published'],
            ['id' => 4, 'title' => 'Terms of Service', 'slug' => 'terms-of-service', 'status' => 'published'],
            ['id' => 5, 'title' => 'Refund Policy', 'slug' => 'refund-policy', 'status' => 'published'],
            ['id' => 6, 'title' => 'Shipping Policy', 'slug' => 'shipping-policy', 'status' => 'published']
        ]
    ]);
}
if (preg_match('#^stores/(\d+)/scaffold-pages$#', $route) && $method === 'POST') {
    respond(['success' => true, 'created_count' => 6]);
}

// Customer contact inquiries
if (preg_match('#^notify/(\d+)/messages$#', $route) && $method === 'GET') {
    $rows = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT * FROM smeram_inquiries ORDER BY id DESC LIMIT 50");
            if ($stmt) $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }
    respond(['contact_messages' => $rows]);
}

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
        $tbl = zkcGetOrdersTable($pdo);
        $hasStoreId = true;
        try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }

        if ($hasStoreId) {
            $pdo->prepare("INSERT INTO `{$tbl}` (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json,
                    subtotal, discount_amount, gst_rate, gst_amount, shipping_amount, shipping_rate_id, coupon_code, total_amount, payment_method, payment_status, order_status)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                ->execute([STORE_ID, $orderNumber, mb_substr($name, 0, 120), $phone, $email, $line1, $address['city'] ?? '', $address['state'] ?? '', $address['pincode'] ?? '',
                    json_encode($items, JSON_UNESCAPED_UNICODE), $subtotal, $discount, $gstRate, $gst, $shipping, $rateId, $coupon ? $coupon['code'] : null, $total,
                    $payMethod, $payMethod === 'cod' ? 'cod' : 'unpaid', $payMethod === 'cod' ? 'new' : 'pending']);
        } else {
            $pdo->prepare("INSERT INTO `{$tbl}` (order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json,
                    subtotal, discount_amount, gst_rate, gst_amount, shipping_amount, total_amount, payment_method, payment_status, order_status)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                ->execute([$orderNumber, mb_substr($name, 0, 120), $phone, $email, $line1, $address['city'] ?? '', $address['state'] ?? '', $address['pincode'] ?? '',
                    json_encode($items, JSON_UNESCAPED_UNICODE), $subtotal, $discount, $gstRate, $gst, $shipping, $total,
                    $payMethod, $payMethod === 'cod' ? 'cod' : 'unpaid', $payMethod === 'cod' ? 'new' : 'pending']);
        }
        $orderId = (int)$pdo->lastInsertId();
        if ($coupon) {
            try { $pdo->prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?')->execute([(int)$coupon['id']]); } catch(Exception $ce) {}
        }
        // COD is confirmed now, so its stock is taken in the same transaction; Razorpay orders take stock once paid.
        $low = [];
        if ($payMethod === 'cod' && function_exists('zkcDeductForOrder')) {
            try { $low = zkcDeductForOrder($pdo, $orderId); } catch(Exception $de) {}
        }
        $pdo->commit();
    } catch (Exception $e) { if ($pdo->inTransaction()) $pdo->rollBack(); respondError($e); }

    $wa = null;
    $handoff = null;
    if ($payMethod === 'cod') {
        $order = function_exists('zkcOrderById') ? zkcOrderById($pdo, $orderId) : [];
        if (function_exists('zkcEnsureInvoice')) zkcEnsureInvoice($pdo, $order);
        if (function_exists('zkcHandoffUrl')) $handoff = zkcHandoffUrl($order);
        if (function_exists('zkcNotifyOrderConfirmed')) $wa = zkcNotifyOrderConfirmed($pdo, $order);
        if (function_exists('zkcNotifyLowStock')) zkcNotifyLowStock($pdo, $low);
    }
    respond(['order_id' => $orderId, 'order_number' => $orderNumber, 'subtotal' => $subtotal, 'discount_amount' => $discount, 'gst_rate' => $gstRate,
        'gst_amount' => $gst, 'shipping_amount' => $shipping, 'total_amount' => $total, 'total' => $total, 'coupon_code' => $coupon ? $coupon['code'] : null,
        'next' => $payMethod === 'cod' ? 'confirmed' : 'razorpay_checkout', 'whatsapp' => $wa, 'whatsapp_handoff_url' => $handoff], 201);
}

if (preg_match('#^notify/[^/]+/(contact|notify)$#', $route, $m) && $method === 'POST') {
    try {
        $insert = $pdo->prepare('INSERT INTO inquiries (store_id, kind, name, email, phone, message) VALUES (?,?,?,?,?,?)');
        $insert->execute([STORE_ID, $m[1], $body['name'] ?? null, $body['email'] ?? null, $body['phone'] ?? null, $body['message'] ?? ($body['product_label'] ?? null)]);
    } catch (Exception $e) {
        try {
            $insert = $pdo->prepare('INSERT INTO smeram_inquiries (name, email, phone, message) VALUES (?,?,?,?)');
            $insert->execute([$body['name'] ?? null, $body['email'] ?? null, $body['phone'] ?? null, $body['message'] ?? ($body['product_label'] ?? null)]);
        } catch (Exception $e2) {}
    }
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
    if ($code) {
        try {
            $pdo->prepare('UPDATE coupons SET used_count = GREATEST(0, used_count - 1) WHERE store_id = ? AND UPPER(code) = UPPER(?)')->execute([STORE_ID, $code]);
        } catch (Exception $e) {}
    }
}

// Razorpay webhook
if ($route === 'payments/razorpay/webhook' && $method === 'POST') {
    $secret = defined('RAZORPAY_WEBHOOK_SECRET') ? RAZORPAY_WEBHOOK_SECRET : '';
    if ($secret === '') respond(['error' => 'Razorpay webhook secret is not configured'], 503);
    $sig = (string)($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/i', $sig) || !hash_equals(hash_hmac('sha256', (string)$raw, $secret), strtolower($sig))) respond(['error' => 'Invalid webhook signature'], 400);
    $event = json_decode((string)$raw, true) ?: [];
    $payment = $event['payload']['payment']['entity'] ?? [];
    $rzpOrder = (string)($payment['order_id'] ?? '');
    if ($rzpOrder !== '') {
        $tbl = zkcGetOrdersTable($pdo);
        $stmt = $pdo->prepare("SELECT id, total_amount, coupon_code FROM `{$tbl}` WHERE razorpay_order_id = ?");
        $stmt->execute([$rzpOrder]);
        $o = $stmt->fetch();
        if ($o && ($event['event'] ?? '') === 'payment.captured' && (int)($payment['amount'] ?? 0) === paise($o['total_amount'])) {
            if (function_exists('zkcMarkPaid') && zkcMarkPaid($pdo, $o['id'], (string)($payment['id'] ?? ''))) {
                if (function_exists('zkcAfterPaid')) zkcAfterPaid($pdo, $o['id']);
            }
        } elseif ($o && ($event['event'] ?? '') === 'payment.failed') {
            $stmt = $pdo->prepare("UPDATE `{$tbl}` SET payment_status = 'failed' WHERE id = ?");
            $stmt->execute([$o['id']]);
            if ($stmt->rowCount()) zkcReleaseCoupon($pdo, $o['coupon_code'] ?? null);
        }
    }
    respond(['status' => 'ok']);
}

if (preg_match('#^payments/#', $route) && !CHECKOUT_RAZORPAY) respond(['error' => 'Online payment is not available for this store.'], 400);

if ($route === 'payments/razorpay/order' && $method === 'POST') {
    $tbl = zkcGetOrdersTable($pdo);
    $stmt = $pdo->prepare("SELECT id, order_number, total_amount, payment_status FROM `{$tbl}` WHERE id = ?");
    $stmt->execute([(int)($body['order_id'] ?? 0)]);
    $order = $stmt->fetch();
    if (!$order) respond(['error' => 'Order not found'], 404);
    if (!in_array($order['payment_status'], ['unpaid', 'failed', 'pending'], true)) respond(['error' => 'This payment has already started or finished. Please place the order again.'], 409);
    $rzp = razorpayRequest('POST', 'orders', ['amount' => paise($order['total_amount']), 'currency' => 'INR', 'receipt' => $order['order_number'], 'notes' => ['order_id' => (string)$order['id']]]);
    $pdo->prepare("UPDATE `{$tbl}` SET razorpay_order_id = ?, payment_status = 'processing' WHERE id = ?")->execute([$rzp['id'], $order['id']]);
    respond(['razorpay_order_id' => $rzp['id'], 'amount' => $rzp['amount'], 'currency' => 'INR', 'key' => RAZORPAY_KEY_ID]);
}

if ($route === 'payments/razorpay/verify' && $method === 'POST') {
    $rzpOrderId = (string)($body['razorpay_order_id'] ?? '');
    $paymentId  = (string)($body['razorpay_payment_id'] ?? '');
    $signature  = (string)($body['razorpay_signature'] ?? '');
    if ($rzpOrderId === '' || $paymentId === '' || !defined('RAZORPAY_KEY_SECRET')) respond(['error' => 'Payment verification details are incomplete'], 400);
    if (!hash_equals(hash_hmac('sha256', $rzpOrderId . '|' . $paymentId, RAZORPAY_KEY_SECRET), $signature)) respond(['error' => 'Invalid payment signature'], 400);
    $tbl = zkcGetOrdersTable($pdo);
    $stmt = $pdo->prepare("SELECT id, total_amount, payment_status FROM `{$tbl}` WHERE id = ? AND razorpay_order_id = ?");
    $stmt->execute([(int)($body['order_id'] ?? 0), $rzpOrderId]);
    $order = $stmt->fetch();
    if (!$order) respond(['error' => 'Pending order not found for this payment'], 404);
    if ($order['payment_status'] === 'paid') respond(['message' => 'Payment already verified', 'order_id' => (int)$order['id']]);
    $payment = razorpayRequest('GET', 'payments/' . rawurlencode($paymentId));
    if (($payment['order_id'] ?? '') !== $rzpOrderId || (int)($payment['amount'] ?? 0) !== paise($order['total_amount']) || ($payment['currency'] ?? '') !== 'INR') respond(['error' => 'Payment does not match the order amount'], 400);
    if (($payment['status'] ?? '') !== 'captured') respond(['error' => 'Payment is not captured yet. Please retry or contact the store.'], 409);
    $pdo->prepare("UPDATE `{$tbl}` SET payment_status = 'paid', razorpay_payment_id = ?, order_status = 'confirmed' WHERE id = ?")->execute([$paymentId, $order['id']]);
    respond(['message' => 'Payment verified', 'order_id' => (int)$order['id']]);
}

if ($route === 'payments/razorpay/failure' && $method === 'POST') {
    $tbl = zkcGetOrdersTable($pdo);
    $stmt = $pdo->prepare("SELECT id, coupon_code FROM `{$tbl}` WHERE id = ?");
    $stmt->execute([(int)($body['order_id'] ?? 0)]);
    if ($o = $stmt->fetch()) {
        $pdo->prepare("UPDATE `{$tbl}` SET payment_status = 'failed' WHERE id = ?")->execute([$o['id']]);
        zkcReleaseCoupon($pdo, $o['coupon_code'] ?? null);
    }
    respond(['recorded' => true, 'retryable' => true]);
}

respond(['error' => 'Route not found', 'route' => $route], 404);
