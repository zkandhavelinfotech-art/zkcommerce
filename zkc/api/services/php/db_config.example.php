<?php
/**
 * ZKCommerce — Example MySQL Database Configuration
 * Copy this file to db_config.php and update with your GoDaddy MySQL credentials.
 */

if (!defined('DB_HOST')) define('DB_HOST', 'localhost');              // In GoDaddy: 'localhost' or your cPanel MySQL host
if (!defined('DB_PORT')) define('DB_PORT', 3306);                     // MySQL default port
if (!defined('DB_NAME')) define('DB_NAME', 'smeram_naturals');        // GoDaddy database name (e.g. username_smeram)
if (!defined('DB_USER')) define('DB_USER', 'smeram_user');            // GoDaddy database username
if (!defined('DB_PASS')) define('DB_PASS', 'YourSecurePassword123!'); // GoDaddy database password
if (!defined('ADMIN_SECRET_KEY')) define('ADMIN_SECRET_KEY', 'Smeram2026!');   // Secret password for admin-orders.php portal
if (!defined('ADMIN_PASSWORD')) define('ADMIN_PASSWORD', 'demo1234');        // Store admin password

/**
 * Returns active PDO connection or null on failure.
 * Captures connection error in $GLOBALS['zkc_db_error'].
 */
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $GLOBALS['zkc_db_error'] = null;
    try {
        $port = defined('DB_PORT') ? (int)DB_PORT : 3306;
        $dsn = "mysql:host=" . DB_HOST . ";port=" . $port . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 5
        ]);
        return $pdo;
    } catch (PDOException $e) {
        $GLOBALS['zkc_db_error'] = $e->getMessage();
        error_log("[ZKCommerce DB Error] " . $e->getMessage());
        return null;
    }
}

/**
 * Returns the last database connection error message if any.
 */
function getDbConnectionError() {
    return $GLOBALS['zkc_db_error'] ?? null;
}

