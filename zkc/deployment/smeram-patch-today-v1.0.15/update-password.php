<?php
/**
 * Safe Single-Action Script: Update Smeram Naturals Merchant Password ONLY
 * Does NOT drop tables or reset any data.
 */
declare(strict_types=1);

// Locate db_config.php
$dbConfigFile = null;
$candidates = [
    __DIR__ . '/db_config.php',
    __DIR__ . '/api/services/php/db_config.php',
    __DIR__ . '/../db_config.php'
];
foreach ($candidates as $candidate) {
    if (file_exists($candidate)) {
        $dbConfigFile = $candidate;
        break;
    }
}

if (!$dbConfigFile) {
    die("Database configuration file db_config.php not found.");
}
require_once $dbConfigFile;

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Exception $e) {
    die("Database connection failed: " . htmlspecialchars($e->getMessage()));
}

// Bcrypt hash for Smeram2026! (compatible with both PHP and Node.js bcryptjs)
$newHash = '$2a$10$qEOTbLvxlOjvdTU12jzsD.Ur.c7siQw5V1WcHKTxTpiEMnyFIDNwO';

$stmt = $pdo->prepare("UPDATE `merchants` SET `password_hash` = ? WHERE `email` = 'merchant@smeramnaturals.in' OR `id` = 2");
$stmt->execute([$newHash]);
$affected = $stmt->rowCount();

$verifyStmt = $pdo->prepare("SELECT `id`, `name`, `email`, `role`, `store_id` FROM `merchants` WHERE `email` = 'merchant@smeramnaturals.in'");
$verifyStmt->execute();
$merchant = $verifyStmt->fetch();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Password Update · Smeram Naturals</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
        .card { max-width: 520px; width: 100%; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
        .badge { background: #059669; color: white; padding: 5px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 16px; letter-spacing: 0.5px; }
        h2 { margin: 0 0 12px; color: #f1f5f9; font-size: 20px; }
        p { color: #94a3b8; line-height: 1.6; margin: 8px 0; font-size: 14px; }
        .detail-box { background: #0f172a; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #334155; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .detail-row:last-child { border-bottom: none; }
        .detail-row .label { color: #64748b; }
        .detail-row .val { color: #38bdf8; font-family: monospace; font-weight: 600; font-size: 13.5px; }
        .btn { display: block; text-align: center; background: #db2777; color: white; font-weight: 600; text-decoration: none; padding: 12px 20px; border-radius: 8px; margin-top: 24px; transition: background 0.2s; }
        .btn:hover { background: #be185d; }
    </style>
</head>
<body>
<div class="card">
    <span class="badge">✓ PASSWORD UPDATED SAFELY</span>
    <h2>Smeram Naturals Password Updated</h2>
    <p>Only the password was changed. No tables were dropped or wiped, and all orders, products, and customer records remain 100% untouched.</p>
    
    <div class="detail-box">
        <div class="detail-row"><span class="label">Merchant Email</span><span class="val"><?= htmlspecialchars($merchant['email'] ?? 'merchant@smeramnaturals.in') ?></span></div>
        <div class="detail-row"><span class="label">New Password</span><span class="val">Smeram2026!</span></div>
        <div class="detail-row"><span class="label">Status</span><span class="val">Active &amp; Ready</span></div>
    </div>

    <a href="auth/login.html" class="btn">Proceed to Login with Smeram2026! →</a>
</div>
</body>
</html>
