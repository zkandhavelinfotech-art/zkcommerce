<?php
/**
 * Shared bootstrap for the PHP admin pages (orders, stock, customers, coupons, invoice).
 * Sign-in happens on admin-orders.php with ADMIN_SECRET_KEY (db_config.php).
 */
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';
if (is_file(__DIR__ . '/whatsapp_config.php')) require_once __DIR__ . '/whatsapp_config.php';
require_once __DIR__ . '/whatsapp_orders.php';
require_once __DIR__ . '/commerce.php';

function h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function zkcIsAdmin() { return ($_SESSION['zkc_admin'] ?? null) === STORE_ID; }

/** Pages other than admin-orders.php: send signed-out visitors to the sign-in form, then back. */
function zkcRequireAdmin($next) {
    if (!zkcIsAdmin()) { header('Location: admin-orders.php?next=' . rawurlencode($next)); exit; }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(503); exit('Could not connect to MySQL. Check db_config.php.'); }
    try { $pdo->exec("SET time_zone = '+05:30'"); } catch (Exception $e) { /* keep the server default */ }
    return $pdo;
}

/** CSRF token for the admin forms. */
function zkcCsrf() {
    if (empty($_SESSION['zkc_csrf'])) $_SESSION['zkc_csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['zkc_csrf'];
}
function zkcCsrfOk() { return hash_equals((string)($_SESSION['zkc_csrf'] ?? ''), (string)($_POST['csrf'] ?? '')); }

function zkcAdminStyles() {
    return '<style>
*{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:20px}
.wrap{max-width:1240px;margin:0 auto}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:16px}
.head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}h1{font-size:20px;margin:0}h2{font-size:16px;margin:0 0 12px}
nav.menu{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}nav.menu a{padding:6px 11px;border-radius:8px;background:#f1f5f9;color:#0f172a;text-decoration:none;font-size:13px;font-weight:600}
nav.menu a.on{background:#0f172a;color:#fff}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top}
th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}.err{color:#b91c1c}.ok{color:#15803d}.muted{color:#64748b;font-size:12px}
input,select,button{font:inherit;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px}button{background:#0f172a;color:#fff;cursor:pointer}
button.light{background:#fff;color:#0f172a}.scroll{overflow-x:auto}.pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:#eef2ff;color:#3730a3}
.pill.low{background:#fef2f2;color:#b91c1c}.wa{background:#25D366;color:#fff;border-radius:6px;padding:4px 9px;text-decoration:none;font-size:12px;font-weight:700;display:inline-block}
</style>';
}

/** Page header with the admin menu. */
function zkcAdminHeader($active, $extra = '') {
    $items = ['orders' => ['admin-orders.php', 'Orders'], 'packaging' => ['packaging.php', '📦 Packaging labels']];
    if (zkcConstOr('EKART_ENABLED', false)) $items['shipments'] = ['shipments.php', '🚚 Shipments (Ekart)'];
    $items += ['stock' => ['stock.php', 'Stock'], 'customers' => ['customers.php', 'Customers'], 'coupons' => ['coupons.php', 'Coupons & shipping']];
    $links = '';
    foreach ($items as $k => $it) $links .= '<a href="' . $it[0] . '" class="' . ($k === $active ? 'on' : '') . '">' . h($it[1]) . '</a>';
    return '<div class="card"><div class="head"><h1>' . h(STORE_NAME) . ' <small style="color:#64748b">(' . h(STORE_ENV) . ' · v' . h(PACKAGE_VERSION) . ')</small></h1><div>' . $extra . ' <a href="admin-orders.php?logout=1">Sign out</a></div></div><nav class="menu">' . $links . '</nav></div>';
}
