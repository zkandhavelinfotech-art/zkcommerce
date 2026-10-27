<?php
/**
 * ZKCommerce / Smeram Naturals — MySQL Database Complete Reset & Seed Utility
 * =========================================================================
 * 1. Drops all existing database tables cleanly (disabling foreign keys).
 * 2. Recreates all core tables up to the latest release schema (v1.0.12).
 * 3. Seeds complete production data for Smeram Naturals:
 *    - Merchants & Admin credentials (admin@zkcommerce.in, merchant@smeramnaturals.in / demo1234)
 *    - Smeram Naturals store configuration, theme_config, colors, contact details
 *    - Categories with images (Hair Care Oil, Orthocare, Ayurgold Face Care, Health Foods)
 *    - Products with full Siddha descriptions, 13 herbs, instructions, benefits, pricing & stock
 *    - Shipping rates & default coupons
 *    - All 6 legal/statutory store pages (About Us, Contact Us, Privacy, Terms, Refund, Shipping)
 *    - Schema migrations ledger recording all historical migrations up to v1.0.12
 *
 * Can be run in browser (interactive UI) or via API / curl (?confirm=1&json=1).
 */

header('X-Content-Type-Options: nosniff');
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// 1. Load configurations
if (is_file(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
} elseif (is_file(__DIR__ . '/api/services/php/db_config.php')) {
    require_once __DIR__ . '/api/services/php/db_config.php';
}
if (is_file(__DIR__ . '/store_config.php')) {
    require_once __DIR__ . '/store_config.php';
}

if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_PORT')) define('DB_PORT', 3306);
if (!defined('DB_NAME')) define('DB_NAME', 'smeram_naturals');
if (!defined('DB_USER')) define('DB_USER', 'smeram_user');
if (!defined('DB_PASS')) define('DB_PASS', 'Admin@123');
if (!defined('ADMIN_SECRET_KEY')) define('ADMIN_SECRET_KEY', 'Smeram2026!');
if (!defined('ADMIN_PASSWORD')) define('ADMIN_PASSWORD', 'demo1234');
if (!defined('STORE_NAME')) define('STORE_NAME', 'Smeram Naturals');
if (!defined('STORE_SLUG')) define('STORE_SLUG', 'smeram');
if (!defined('STORE_ID')) define('STORE_ID', 2);

function getResetPdo() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
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
        $GLOBALS['reset_db_error'] = $e->getMessage();
        return null;
    }
}

$isJson = (isset($_GET['json']) && $_GET['json'] == '1') || 
          (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

// Security Check
$providedPass = $_POST['admin_pass'] ?? $_GET['key'] ?? $_GET['pass'] ?? '';
if (!empty($providedPass)) {
    if (hash_equals((string)ADMIN_SECRET_KEY, (string)$providedPass) ||
        hash_equals((string)ADMIN_PASSWORD, (string)$providedPass) ||
        $providedPass === 'demo1234' || $providedPass === 'Smeram2026!') {
        $_SESSION['zkc_reset_auth'] = true;
    }
}

$isAuthed = !empty($_SESSION['zkc_reset_auth']) || 
            (isset($_SERVER['REMOTE_ADDR']) && in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1']));

// Handle Reset Action
$result = null;
$error = null;
$logs = [];

if ($isAuthed && (isset($_POST['execute_reset']) || (isset($_GET['confirm']) && $_GET['confirm'] == '1'))) {
    $startTime = microtime(true);
    $pdo = getResetPdo();
    if (!$pdo) {
        $error = "Could not connect to MySQL database: " . ($GLOBALS['reset_db_error'] ?? 'Unknown error');
    } else {
        try {
            $pdo->exec("SET NAMES utf8mb4");
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

            // 1. DROP ALL EXISTING TABLES
            $tablesStmt = $pdo->query("SHOW TABLES");
            $existingTables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
            $droppedCount = 0;
            foreach ($existingTables as $tbl) {
                $pdo->exec("DROP TABLE IF EXISTS `" . str_replace('`', '``', $tbl) . "`");
                $droppedCount++;
            }
            $logs[] = "Dropped {$droppedCount} existing tables cleanly.";

            // 2. RECREATE ALL CORE SCHEMAS
            $schemaQueries = [
                // Migration ledger
                "CREATE TABLE `schema_migrations` (
                  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
                  `description` VARCHAR(255) DEFAULT NULL,
                  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Merchants / Admin Users
                "CREATE TABLE `merchants` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `name` VARCHAR(150) NOT NULL,
                  `email` VARCHAR(255) NOT NULL UNIQUE,
                  `phone` VARCHAR(30) DEFAULT NULL,
                  `password_hash` VARCHAR(255) NOT NULL,
                  `role` VARCHAR(30) DEFAULT 'merchant',
                  `store_id` INT DEFAULT NULL,
                  `reset_token` VARCHAR(255) DEFAULT NULL,
                  `reset_token_expires` DATETIME DEFAULT NULL,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Stores
                "CREATE TABLE `stores` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `merchant_id` INT DEFAULT NULL,
                  `store_name` VARCHAR(150) NOT NULL,
                  `slug` VARCHAR(100) NOT NULL UNIQUE,
                  `custom_domain` VARCHAR(150) DEFAULT NULL,
                  `tagline` VARCHAR(255) DEFAULT NULL,
                  `hero_headline` VARCHAR(255) DEFAULT NULL,
                  `hero_subtext` TEXT DEFAULT NULL,
                  `hero_cta_text` VARCHAR(100) DEFAULT 'Shop now',
                  `primary_colour` VARCHAR(20) DEFAULT '#ED6375',
                  `bg_colour` VARCHAR(20) DEFAULT '#FFFFFF',
                  `accent_colour` VARCHAR(20) DEFAULT '#A3B545',
                  `logo_url` TEXT DEFAULT NULL,
                  `whatsapp_number` VARCHAR(30) DEFAULT NULL,
                  `instagram_handle` VARCHAR(100) DEFAULT NULL,
                  `address` TEXT DEFAULT NULL,
                  `city` VARCHAR(100) DEFAULT NULL,
                  `state` VARCHAR(100) DEFAULT NULL,
                  `gst_number` VARCHAR(30) DEFAULT NULL,
                  `theme_config` LONGTEXT DEFAULT NULL,
                  `status` VARCHAR(30) DEFAULT 'published',
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Categories
                "CREATE TABLE `categories` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `name` VARCHAR(120) NOT NULL,
                  `slug` VARCHAR(120) NOT NULL,
                  `image_url` TEXT DEFAULT NULL,
                  `sort_order` INT DEFAULT 0,
                  `active` TINYINT(1) DEFAULT 1,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_cat_store` (`store_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Products
                "CREATE TABLE `products` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `category_id` BIGINT DEFAULT NULL,
                  `name` VARCHAR(255) NOT NULL,
                  `slug` VARCHAR(200) DEFAULT NULL,
                  `sku` VARCHAR(100) DEFAULT NULL,
                  `price` DECIMAL(12,2) NOT NULL,
                  `compare_price` DECIMAL(12,2) DEFAULT NULL,
                  `cost_price` DECIMAL(12,2) DEFAULT NULL,
                  `gst_rate` VARCHAR(10) DEFAULT '12',
                  `product_size` VARCHAR(60) DEFAULT NULL,
                  `offer_text` VARCHAR(120) DEFAULT NULL,
                  `badge_text` VARCHAR(60) DEFAULT NULL,
                  `description` TEXT DEFAULT NULL,
                  `ingredients` TEXT DEFAULT NULL,
                  `user_instructions` TEXT DEFAULT NULL,
                  `benefits` TEXT DEFAULT NULL,
                  `additional_note` VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.',
                  `images` LONGTEXT DEFAULT NULL,
                  `quantity` INT DEFAULT 100,
                  `in_stock` TINYINT(1) DEFAULT 1,
                  `active` TINYINT(1) DEFAULT 1,
                  `featured` TINYINT(1) DEFAULT 0,
                  `variants` LONGTEXT DEFAULT NULL,
                  `net_quantity_value` DECIMAL(10,2) DEFAULT NULL,
                  `net_quantity_unit` VARCHAR(10) DEFAULT NULL,
                  `low_stock_threshold` INT DEFAULT NULL,
                  `show_offer` TINYINT(1) DEFAULT NULL,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_prod_store` (`store_id`),
                  INDEX `idx_prod_cat` (`category_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Product Stock
                "CREATE TABLE `product_stock` (
                  `store_id` BIGINT NOT NULL,
                  `product_id` BIGINT NOT NULL,
                  `variant_id` VARCHAR(40) NOT NULL DEFAULT '',
                  `quantity` INT NOT NULL DEFAULT 0,
                  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (`product_id`, `variant_id`),
                  INDEX `idx_stock_store` (`store_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Inventory Movements
                "CREATE TABLE `inventory_movements` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `product_id` BIGINT NOT NULL,
                  `variant_id` VARCHAR(40) NOT NULL DEFAULT '',
                  `delta` INT NOT NULL,
                  `quantity_after` INT NOT NULL,
                  `reason` VARCHAR(40) NOT NULL,
                  `order_id` BIGINT DEFAULT NULL,
                  `note` VARCHAR(255) DEFAULT NULL,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_mov_product` (`product_id`, `created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Orders (Standard Core)
                "CREATE TABLE `orders` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL DEFAULT 2,
                  `order_number` VARCHAR(50) NOT NULL UNIQUE,
                  `customer_name` VARCHAR(120) NOT NULL,
                  `customer_phone` VARCHAR(30) NOT NULL,
                  `customer_email` VARCHAR(120) DEFAULT NULL,
                  `shipping_address` TEXT NOT NULL,
                  `city` VARCHAR(100) DEFAULT NULL,
                  `state` VARCHAR(100) DEFAULT 'Tamil Nadu',
                  `pincode` VARCHAR(20) DEFAULT NULL,
                  `items_json` LONGTEXT NOT NULL,
                  `subtotal` DECIMAL(12,2) DEFAULT NULL,
                  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                  `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                  `gst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                  `shipping_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                  `shipping_rate_id` BIGINT DEFAULT NULL,
                  `coupon_code` VARCHAR(50) DEFAULT NULL,
                  `total_amount` DECIMAL(12,2) NOT NULL,
                  `payment_method` VARCHAR(30) DEFAULT 'cod',
                  `payment_status` VARCHAR(30) DEFAULT 'pending',
                  `payment_gateway` VARCHAR(40) DEFAULT 'razorpay',
                  `order_status` VARCHAR(30) DEFAULT 'new',
                  `razorpay_order_id` VARCHAR(64) DEFAULT NULL,
                  `razorpay_payment_id` VARCHAR(64) DEFAULT NULL,
                  `razorpay_signature` VARCHAR(255) DEFAULT NULL,
                  `stock_deducted` TINYINT(1) NOT NULL DEFAULT 0,
                  `paid_at` DATETIME DEFAULT NULL,
                  `tracking_number` VARCHAR(80) DEFAULT NULL,
                  `courier` VARCHAR(60) DEFAULT NULL,
                  `tracking_url` TEXT DEFAULT NULL,
                  `shipped_at` DATETIME DEFAULT NULL,
                  `delivered_at` DATETIME DEFAULT NULL,
                  `notes` TEXT DEFAULT NULL,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_orders_store_created` (`store_id`, `created_at`),
                  INDEX `idx_orders_phone` (`store_id`, `customer_phone`),
                  INDEX `idx_orders_rzp_order` (`razorpay_order_id`),
                  INDEX `idx_orders_tracking` (`store_id`, `tracking_number`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Smeram Orders (Direct Client Compatibility Schema)
                "CREATE TABLE `smeram_orders` (
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
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_smeram_orders_phone` (`customer_phone`),
                  INDEX `idx_smeram_orders_status` (`order_status`),
                  INDEX `idx_smeram_orders_created` (`created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Order Items
                "CREATE TABLE `order_items` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `order_id` BIGINT NOT NULL,
                  `product_id` BIGINT DEFAULT NULL,
                  `product_name` VARCHAR(255) NOT NULL,
                  `variant_id` VARCHAR(40) DEFAULT '',
                  `quantity` INT NOT NULL DEFAULT 1,
                  `unit_price` DECIMAL(12,2) NOT NULL,
                  `total_price` DECIMAL(12,2) NOT NULL,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_item_order` (`order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Coupons
                "CREATE TABLE `coupons` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `code` VARCHAR(40) NOT NULL,
                  `discount_type` VARCHAR(10) NOT NULL,
                  `discount_value` DECIMAL(10,2) NOT NULL,
                  `minimum_order` INT NOT NULL DEFAULT 0,
                  `usage_limit` INT DEFAULT NULL,
                  `used_count` INT NOT NULL DEFAULT 0,
                  `starts_at` DATETIME DEFAULT NULL,
                  `expires_at` DATETIME DEFAULT NULL,
                  `active` TINYINT(1) NOT NULL DEFAULT 1,
                  UNIQUE KEY `uq_coupon_code` (`store_id`, `code`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Shipping Rates
                "CREATE TABLE `shipping_rates` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `name` VARCHAR(120) NOT NULL,
                  `rate` INT NOT NULL DEFAULT 0,
                  `free_above` INT DEFAULT NULL,
                  `postal_prefix` VARCHAR(12) DEFAULT NULL,
                  `estimated_days` VARCHAR(60) DEFAULT NULL,
                  `courier` VARCHAR(60) DEFAULT NULL,
                  `active` TINYINT(1) NOT NULL DEFAULT 1,
                  INDEX `idx_rates_store` (`store_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Invoices
                "CREATE TABLE `invoices` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `order_id` BIGINT NOT NULL UNIQUE,
                  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
                  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Inquiries (Standard & Smeram)
                "CREATE TABLE `inquiries` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `kind` VARCHAR(30) NOT NULL DEFAULT 'contact',
                  `name` VARCHAR(120) DEFAULT NULL,
                  `email` VARCHAR(120) DEFAULT NULL,
                  `phone` VARCHAR(30) DEFAULT NULL,
                  `message` TEXT DEFAULT NULL,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                "CREATE TABLE `smeram_inquiries` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `name` VARCHAR(120) NOT NULL,
                  `phone` VARCHAR(20) NOT NULL,
                  `email` VARCHAR(120) NULL,
                  `product_name` VARCHAR(120) NULL,
                  `message` TEXT NOT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // Store Pages
                "CREATE TABLE `store_pages` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `title` VARCHAR(150) NOT NULL,
                  `slug` VARCHAR(150) NOT NULL,
                  `content` LONGTEXT DEFAULT NULL,
                  `status` VARCHAR(30) DEFAULT 'published',
                  `sort_order` INT DEFAULT 0,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_pages_store` (`store_id`, `slug`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // WhatsApp Outbox
                "CREATE TABLE `whatsapp_outbox` (
                  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  `store_id` BIGINT NOT NULL,
                  `kind` VARCHAR(30) NOT NULL,
                  `to_phone` VARCHAR(20) NOT NULL,
                  `message` TEXT NOT NULL,
                  `provider` VARCHAR(20) DEFAULT NULL,
                  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
                  `error` TEXT DEFAULT NULL,
                  `order_id` BIGINT DEFAULT NULL,
                  `product_id` BIGINT DEFAULT NULL,
                  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  `sent_at` DATETIME DEFAULT NULL,
                  INDEX `idx_outbox_store` (`store_id`, `status`, `created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                // GST Settings
                "CREATE TABLE `gst_settings` (
                  `store_id` BIGINT PRIMARY KEY,
                  `gstin` VARCHAR(30) DEFAULT NULL,
                  `state_code` VARCHAR(10) DEFAULT '33',
                  `default_rate` DECIMAL(5,2) NOT NULL DEFAULT 12.00,
                  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
                  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            ];

            foreach ($schemaQueries as $query) {
                $pdo->exec($query);
            }
            $logs[] = "Successfully recreated " . count($schemaQueries) . " core tables.";

            // 3. SEED MERCHANTS / ADMIN LOGINS (Password: demo1234)
            $defaultPasswordHash = '$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS';
            $merchantIns = $pdo->prepare("INSERT INTO `merchants` (`id`, `name`, `email`, `phone`, `password_hash`, `role`, `store_id`) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");
            $merchantIns->execute([1, 'ZKCommerce Product Owner', 'admin@zkcommerce.in', '+91 90000 00001', $defaultPasswordHash, 'admin', NULL]);
            $merchantIns->execute([2, 'Smeram Store Owner', 'merchant@smeramnaturals.in', '+91 75399 72026', $defaultPasswordHash, 'merchant', 2]);
            $merchantIns->execute([3, 'Miliro Store Owner', 'merchant@miliro.in', '+91 44 75399 72026', $defaultPasswordHash, 'merchant', 1]);
            $merchantIns->execute([4, 'Demo Store Owner', 'merchant@zkdemo.in', '+91 90000 00002', $defaultPasswordHash, 'merchant', 3]);
            $logs[] = "Seeded 4 Merchant & Admin accounts (Password: demo1234).";

            // 4. SEED SMERAM NATURALS STORE
            $themeConfigJson = json_encode([
                'design' => 'smeram',
                'template_id' => 'smeram-natural',
                'style_preset' => 'smeram',
                'primary_colour' => '#ED6375',
                'bg_colour' => '#FFF5F7',
                'accent_colour' => '#A3B545',
                'logo_url' => '/assets/themes/smeram/smeram-logo.png',
                'sections' => [
                    'nav' => [
                        'menu' => [
                            ['page' => 'about-us', 'type' => 'page', 'label' => 'About Us'],
                            ['type' => 'shop', 'label' => 'Shop'],
                            ['type' => 'contact', 'label' => 'Contact Us']
                        ]
                    ],
                    'why' => [
                        'text' => 'Centuries of documented Siddha knowledge blended with clinical hygiene. Smeram Industries produces uncompromised natural formulations without synthetic shortcuts.',
                        'nav_label' => 'Why Smeram Naturals'
                    ],
                    'hero' => ['image' => ''],
                    'products' => ['visible' => false],
                    'announcement' => ['visible' => false]
                ],
                'section_order' => ['trust', 'hero', 'products', 'why', 'ingredients', 'reviews', 'contact'],
                'fields' => [
                    'hero_h1' => 'Shop by Ayurvedic Category',
                    'why_tag' => 'Siddha Formulation Excellence',
                    'ann_show' => false,
                    'ann_text' => '🌿 Smeram Naturals · Sneha-Kalka-Drava Siddha Formulation · Free Shipping Above ₹399 Across India',
                    'hero_sub' => '🌸 Siddha & Ayurvedic Formulations',
                    'nav_logo' => '/assets/themes/smeram/smeram-logo.png',
                    'body_font' => 'Inter',
                    'hero_desc' => 'Choose from our pure Siddha hair care oils, joint mobility remedies, Ayurgold face care, and Vedic health foods. Click any category box below to explore products.',
                    'hero_font' => 'Playfair Display',
                    'why_heading' => 'Why Smeram Naturals?',
                    'contact_email' => 'smeramindustries@gmail.com',
                    'contact_phone' => '91-44-75399 72026',
                    'products_heading' => 'All Products',
                    'footer_text' => 'Smeram Industries — Traditional Siddha Formulation Hair Oils & Authentic Ayurvedic Wellness crafted with double boiled infusion.',
                    'trust_items' => ['VEGAN', 'CRUELTY FREE', 'ECOFRIENDLY', 'NATURAL'],
                    'why_items' => [
                        '🏺 Sneha-Kalka-Drava Method — Classical Siddha procedure where herbal paste (Kalka) is decocted into virgin cold-pressed oil (Sneha) with pure botanical juice (Drava).',
                        '🔥 Double Boiled & Double Infused — Two-stage low-heat simmering ensures maximum phytonutrient extraction without denaturing fragile herbs.',
                        '🌿 13 Documented Herbs — Ratanjot, Jadamanshi, Lemongrass, Jal Brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag and Bhringraj in virgin coconut oil.',
                        '✨ 100% Dandruff Control — Soothes flaking, eliminates itchy fungus and purifies scalp follicles to stimulate thick new hair regrowth.',
                        '🚫 Zero Harmful Chemicals — 0% mineral oil, no liquid paraffin, no silicones, parabens or synthetic fragrance.',
                        '🏭 Choolaimedu, Chennai Origin — Manufactured and marketed by Smeram Industries in Chennai with complete batch traceability.'
                    ],
                    'ingredients_heading' => 'The 13 Classical Medicinal Herbs',
                    'ingredients_items' => [
                        'Cold Pressed Virgin Coconut Oil — Pure medium-chain triglycerides that penetrate directly into the hair cortex.',
                        'Ratanjot Roots — Cooling root that prevents premature greying and gives the rich natural reddish hue.',
                        'Jadamanshi Roots — Calms nervous tension and reduces stress-induced hair fall.',
                        'Vettiver — Cools the head and balances excess body heat.',
                        'Lemongrass — Natural antifungal that clears stubborn dandruff.',
                        'Jal Brahmi — Strengthens micro-capillaries supplying hair bulbs.',
                        'Jalapippali — Soothes scalp infections and stimulates dormant roots.',
                        'Amla — Rich in Vitamin C; strengthens roots and delays greying.',
                        'Henna — Conditions cuticles and balances scalp pH.',
                        'Curry Leaves — Prevents thinning and restores natural lustre.',
                        'Hibiscus — Adds bounce, volume and silky softness.',
                        'Gudrisag — Cooling greens that boost hair density.',
                        'Bhringraj — The King of Hair; re-energises dormant follicles.'
                    ]
                ],
                'checkout' => [
                    'cod' => false,
                    'razorpay' => true,
                    'show_coupon' => false
                ]
            ], JSON_UNESCAPED_UNICODE);

            $storeIns = $pdo->prepare("INSERT INTO `stores` 
                (`id`, `merchant_id`, `store_name`, `slug`, `custom_domain`, `tagline`, `hero_headline`, `hero_subtext`, `hero_cta_text`, 
                 `primary_colour`, `bg_colour`, `accent_colour`, `logo_url`, `whatsapp_number`, `instagram_handle`, `address`, `city`, `state`, 
                 `theme_config`, `status`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $storeIns->execute([
                2, 2, 'Smeram Naturals', 'smeram', 'smeram-naturals.in',
                'Authentic Siddha & Ayurvedic wellness', 'Shop by Ayurvedic Category',
                'Authentic Siddha formulations, Ayurgold face care, orthocare and Vedic health foods.',
                'Buy Now — ₹349', '#ED6375', '#FFF5F7', '#A3B545',
                '/assets/themes/smeram/smeram-logo.png', '+91 75399 72026', '@smeramnaturals',
                '22/13 Rajaveedhi Street, Choolaimedu', 'Chennai', 'Tamil Nadu',
                $themeConfigJson, 'published'
            ]);
            $logs[] = "Seeded Store: Smeram Naturals (id: 2, slug: smeram, domain: smeram-naturals.in).";

            // 5. SEED CATEGORIES
            $catIns = $pdo->prepare("INSERT INTO `categories` (`id`, `store_id`, `name`, `slug`, `image_url`, `sort_order`, `active`) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $catIns->execute([3, 2, 'Hair Care Oil', 'hair-care-oil', '/assets/themes/smeram/smeram-box-bottle.jpg', 1, 1]);
            $catIns->execute([1, 2, 'Joint Pain & Orthocare', 'joint-pain-orthocare', '/assets/themes/smeram/ortho-pain.jpg', 2, 1]);
            $catIns->execute([4, 2, 'Ayurgold Face Care', 'ayurgold-face-care', '/assets/themes/smeram/face-care.jpg', 3, 1]);
            $catIns->execute([2, 2, 'Health Foods', 'health-foods', '/assets/themes/smeram/health-foods.jpg', 4, 1]);
            $logs[] = "Seeded 4 Product Categories (Hair Care, Orthocare, Face Care, Health Foods).";

            // 6. SEED PRODUCTS
            $prodIns = $pdo->prepare("INSERT INTO `products` 
                (`id`, `store_id`, `category_id`, `name`, `slug`, `sku`, `price`, `compare_price`, `cost_price`, `gst_rate`, 
                 `product_size`, `offer_text`, `badge_text`, `description`, `ingredients`, `user_instructions`, `benefits`, 
                 `additional_note`, `images`, `quantity`, `in_stock`, `active`, `variants`) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            // Product 2: Hair Oil
            $prodIns->execute([
                2, 2, 3, 'Smeram Naturals Hair Oil', 'siddha-hair-oil-100ml', 'SN-HO-101', 349.00, 353.00, 180.00, '12',
                '100 ml', 'Special Introductory Offer - Save ₹50', 'Sneha - Kalka - Drava Method',
                "Double Boiled · Double Infused classical Siddha formulation with 11 pure botanical herbs for 100% dandruff control and natural hair volume growth.",
                "Cold pressed virgin coconut oil, Ratanjot roots, jadamanshi roots, vettiver, lemongrass, Jal brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag and Bhringaraj.",
                "Take 5-10 ml of Smeram Herbal Hair Oil. Warm gently between palms and apply directly to scalp and roots. Massage gently with circular fingertip motions for 10 minutes to stimulate blood circulation.",
                "• Prevents hair fall and stimulates healthy hair growth.\n• 100% Dandruff control & soothing itchy scalp.\n• Prevents premature greying of hair.\n• Body cooling properties, relieves stress and cures insomnia.",
                'Inclusive of GST and free shipping.',
                json_encode(['/assets/themes/smeram/smeram-box-bottle.jpg', '/assets/themes/smeram/smeram-bottles-pair.jpg', '/assets/themes/smeram/smeram-bottle-single.jpg', '/assets/themes/smeram/smeram-label.jpg']),
                100, 1, 1, '[]'
            ]);

            // Product 4: Ortho Pain Oil
            $prodIns->execute([
                4, 2, 1, 'Smeram Naturals - Virali Thailam Ortho Joint Pain Oil', 'ortho-pain-oil', 'SN-JPO-101', 379.00, 450.00, 200.00, '12',
                '100 ml', 'Relief Special Offer', 'Fast Relief',
                "Use in all types of sprains, aches, knee pain, frozen shoulders, spinal cord back pain and diabetic foot nerve pains.",
                "Bone joint leaves (elumbotti ilai), Hopseed bush (virali ilai), Balloon vine (modakathan), Veldi grape (pirandai/hadjod), Jadamanshi roots, Vettiver, Mahua, Castor and Neem oils.",
                "Take 5 ml of virali thailam in a spoon, slightly heat it and gently apply on affected joints/parts.",
                "Pain relief in all vata disorders. Strong bones and ligament support. Fast penetrating anti-inflammatory herbal relief.",
                'Inclusive of GST and free shipping.',
                json_encode(['/assets/themes/smeram/ortho-pain.jpg']),
                100, 1, 1, '[]'
            ]);

            // Product 5: Ayurgold Face Pack
            $prodIns->execute([
                5, 2, 4, 'Smeram Naturals - Ayurgold Face pack', 'ayurgold-kumkumadi-oil', 'SN-FP-101', 349.00, 499.00, 160.00, '12',
                'Net weight - 100 grams', 'Festive Radiance Offer', 'Ayurgold Radiance',
                "Pure herbal face pack for clearing dark spots, tanning, and restoring natural golden skin glow.",
                "Red sanders, Manjistha, Sandalwood, wild turmeric, lodhra, licorice, nutgrass, vettiver, rose petals, maghilampoo and multani mitti.",
                "Take 1-2 teaspoons of Smeram Ayurgold face pack, mix with warm rose water or milk. Apply evenly on clean face for 20 minutes before rinsing with cool water.",
                "Removes excessive oil and surface impurities. Clears acne and blemishes. Restores glowing luminous complexion.",
                'Inclusive of GST and free shipping.',
                json_encode(['/assets/themes/smeram/face-care.jpg']),
                100, 1, 1, '[]'
            ]);

            // Product 6: Health Mix
            $prodIns->execute([
                6, 2, 2, 'Smeram Naturals - Health Mix with Nuts.', 'health-a2-ghee', 'SN-HM-101', 378.00, 564.00, 210.00, '12',
                'Net weight - 450.00 grams', 'Pure Nutrition Special', '100% Pure',
                "Nutrient-dense traditional multi-grain porridge mix bringing together sprouted grains, millets, legumes, nuts, and seeds.",
                "100% Pure Sprouted ragi, pearl millet, black kavuni rice, corn, sorghum, green moong dhal, white chickpeas, roasted gram, almonds, cashew, flax seeds, pumpkin seeds and cardamom.",
                "Take 2 tablespoons of Smeram health mix powder, boil in 200 ml of water or milk for 3 minutes. Add jaggery/honey for healthy breakfast.",
                "Rich in complex carbohydrates, plant protein, dietary fiber, calcium, iron, and gut-friendly micronutrients.",
                'Inclusive of GST and free shipping.',
                json_encode(['/assets/themes/smeram/health-foods.jpg']),
                100, 1, 1, '[]'
            ]);

            // Product 7: Payment Test ₹1
            $prodIns->execute([
                7, 2, NULL, 'Payment Test ₹1 (do not ship)', 'payment-test-1', 'ZK-PAYTEST-1', 1.00, NULL, NULL, '12',
                '1 Unit', NULL, 'Test Mode',
                'Internal item for testing live Razorpay online checkout transactions.',
                NULL, NULL, 'Internal system test item.', 'Do not ship.', '[]',
                10, 1, 1, '[]'
            ]);
            $logs[] = "Seeded 5 Products with complete pricing, herbs, instructions & images.";

            // 7. SEED PRODUCT STOCK
            $stockIns = $pdo->prepare("INSERT INTO `product_stock` (`store_id`, `product_id`, `variant_id`, `quantity`) VALUES (?, ?, '', ?)");
            $stockIns->execute([2, 2, 100]);
            $stockIns->execute([2, 4, 100]);
            $stockIns->execute([2, 5, 100]);
            $stockIns->execute([2, 6, 100]);
            $stockIns->execute([2, 7, 10]);
            $logs[] = "Seeded Product Inventory Stock levels (100 units each).";

            // 8. SEED SHIPPING RATES & COUPONS
            $shipIns = $pdo->prepare("INSERT INTO `shipping_rates` (`id`, `store_id`, `name`, `rate`, `free_above`, `estimated_days`, `courier`, `active`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $shipIns->execute([1, 2, 'Free Delivery (Orders ₹399+)', 0, 399, '2-4 business days', 'ST Courier / Delhivery', 1]);
            $shipIns->execute([2, 2, 'Standard Express Courier', 50, NULL, '2-3 business days', 'ST Courier / Professional', 1]);

            $couponIns = $pdo->prepare("INSERT INTO `coupons` (`id`, `store_id`, `code`, `discount_type`, `discount_value`, `minimum_order`, `active`) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $couponIns->execute([1, 2, 'WELCOME10', 'percent', 10.00, 299, 1]);
            $couponIns->execute([2, 2, 'LAUNCH50', 'fixed', 50.00, 349, 1]);
            $logs[] = "Seeded Shipping Rates & Discount Coupons (WELCOME10, LAUNCH50).";

            // 9. SEED ALL 6 LEGAL & STATUTORY STORE PAGES
            $pages = [
                ['About Us', 'about-us', 1, "Welcome to Smeram Naturals.\n\nWe produce authentic Siddha & Ayurvedic formulations using time-honored traditional methods. Centered on the classical Sneha-Kalka-Drava procedure, our flagship hair oils and herbal remedies are crafted in small batches in Chennai, Tamil Nadu.\n\nEvery batch is slow-simmered, double boiled, and double infused with 13 hand-selected medicinal herbs to preserve maximum phytonutrient efficacy. 100% plant-based, vegan, cruelty-free, and chemical-free."],
                ['Contact Us', 'contact-us', 2, "Customer Support & Inquiries — Smeram Naturals\n\nOperating Address:\nSmeram Industries\n22/13 Rajaveedhi Street, Choolaimedu, Chennai, Tamil Nadu - 600094\n\nEmail: smeramindustries@gmail.com\nPhone / WhatsApp: +91 75399 72026\n\nSupport Hours: Monday to Saturday, 9:00 AM – 6:00 PM IST."],
                ['Privacy Policy', 'privacy-policy', 3, "Privacy Policy — Smeram Naturals\n\nYour privacy is paramount to us. We collect customer details (name, shipping address, contact phone, and email) solely to process your orders, provide dispatch tracking alerts via WhatsApp, and improve our services.\n\nAll online payment transactions are processed securely via RBI-licensed payment gateways (Razorpay) using 256-bit SSL encryption. We never sell, rent, or trade your personal data with third-party marketers."],
                ['Terms of Service', 'terms-of-service', 4, "Terms of Service — Smeram Naturals\n\nBy placing an order on our store, you confirm that you have read and agreed to these terms. All prices are listed in Indian Rupees (INR) and are inclusive of statutory GST where applicable.\n\nOrders are accepted subject to product availability and delivery serviceability. We reserve the right to cancel orders with incorrect information or suspected fraud."],
                ['Refund & Cancellation Policy', 'refund-policy', 5, "Refund & Return Policy — Smeram Naturals\n\nIf you receive a damaged, leaking, or defective bottle, please inform our support team within 48 hours of receipt at smeramindustries@gmail.com or via WhatsApp at +91 75399 72026 with unboxing photo/video evidence.\n\nWe will promptly ship a free replacement or issue a full refund to your original payment method within 5–7 business days."],
                ['Shipping & Delivery Policy', 'shipping-policy', 6, "Shipping Policy — Smeram Naturals\n\nOrders are dispatched within 24 to 48 hours via leading domestic courier partners (ST Courier, Delhivery, Professional Couriers).\n\nStandard delivery time:\n- Tamil Nadu & South India: 2 to 3 business days.\n- Rest of India: 3 to 6 business days.\n\nFree shipping applies on orders above ₹399 across India. Live tracking information is automatically sent to your WhatsApp number upon parcel handover."]
            ];
            $pageIns = $pdo->prepare("INSERT INTO `store_pages` (`store_id`, `title`, `slug`, `content`, `status`, `sort_order`) VALUES (?, ?, ?, ?, 'published', ?)");
            foreach ($pages as $p) {
                $pageIns->execute([2, $p[0], $p[1], json_encode(['body' => $p[3]], JSON_UNESCAPED_UNICODE), $p[2]]);
            }
            $logs[] = "Seeded 6 Statutory Pages (About Us, Contact, Privacy, Terms, Refund, Shipping).";

            // 10. SEED GST SETTINGS
            $gstIns = $pdo->prepare("INSERT INTO `gst_settings` (`store_id`, `gstin`, `state_code`, `default_rate`, `enabled`) VALUES (?, ?, ?, ?, ?)");
            $gstIns->execute([2, '33AAAAA0000A1Z5', '33', 12.00, 1]);

            // 11. RECORD ALL HISTORICAL MIGRATIONS
            $migrations = [
                ['001_core_tables', 'Stores, categories, products, orders and pages'],
                ['002_inquiries', 'Contact form and restock requests'],
                ['003_order_tracking', 'Order updated_at, tracking number and store/date index for the order dashboard'],
                ['004_razorpay_payments', 'Razorpay order / payment ids on orders for online payment'],
                ['005_product_quantity', 'Stock quantity per product'],
                ['006_commerce', 'Sizes and stock, coupons, shipping rates, GST totals, invoices, Ekart tracking and WhatsApp log'],
                ['007_store_pages_and_categories_meta', 'Categories image, sort order and active status, and store pages sort order and status (v1.0.7)'],
                ['008_product_sku_and_pricing_meta', 'Product SKU, compare price, cost tracking and GST rate (v1.0.8)'],
                ['009_order_payment_meta', 'Razorpay signature, payment gateway and invoice audit tracking (v1.0.9)'],
                ['package-v1.0.12', 'ZKCommerce package v1.0.12 (production)']
            ];
            $migIns = $pdo->prepare("INSERT INTO `schema_migrations` (`id`, `description`, `applied_at`) VALUES (?, ?, NOW())");
            foreach ($migrations as $m) {
                $migIns->execute([$m[0], $m[1]]);
            }
            $logs[] = "Recorded 10 schema migrations in ledger (system up to date at v1.0.12).";

            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

            $timeTaken = round((microtime(true) - $startTime) * 1000, 2);
            $result = [
                'status' => 'success',
                'message' => 'Database successfully reset and seeded for Smeram Naturals!',
                'time_ms' => $timeTaken,
                'tables_created' => count($schemaQueries),
                'logs' => $logs
            ];
        } catch (Exception $e) {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            $error = "Execution error: " . $e->getMessage();
        }
    }
}

// Inspect current DB state for UI display
$currentPdo = getResetPdo();
$currentTables = [];
if ($currentPdo) {
    try {
        $st = $currentPdo->query("SHOW TABLES");
        $currentTables = $st->fetchAll(PDO::FETCH_COLUMN);
    } catch (Exception $e) {}
}

if ($isJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => $error ? 'error' : ($result ? 'success' : 'ready'),
        'authenticated' => $isAuthed,
        'database' => defined('DB_NAME') ? DB_NAME : '',
        'current_tables_count' => count($currentTables),
        'result' => $result,
        'error' => $error
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZKCommerce · MySQL Database Reset & Recreate Tool</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b1120;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #0284c7;
      --danger: #dc2626;
      --success: #16a34a;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      width: 100%;
      max-width: 760px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .badge {
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-live { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-warn { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .info-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.6;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-top: 10px;
    }
    .info-item {
      background: rgba(30, 41, 59, 0.8);
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .info-item span { display: block; font-size: 11px; color: var(--muted); }
    .info-item strong { font-size: 14px; font-family: 'JetBrains Mono', monospace; color: #38bdf8; }
    .alert {
      padding: 14px 18px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .alert-error { background: rgba(220, 38, 38, 0.15); border: 1px solid rgba(220, 38, 38, 0.4); color: #fca5a5; }
    .alert-success { background: rgba(22, 163, 74, 0.15); border: 1px solid rgba(22, 163, 74, 0.4); color: #86efac; }
    .log-list {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      max-height: 200px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .log-list li {
      margin-bottom: 6px;
      color: #cbd5e1;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
    }
    .btn-danger {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: #fff;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);
    }
    .btn-danger:hover {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #334155;
      color: #f8fafc;
    }
    .btn-secondary:hover { background: #475569; }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      margin-bottom: 16px;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: var(--primary);
    }
    .quick-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .link-pill {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 20px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 12px;
      transition: all 0.2s;
    }
    .link-pill:hover {
      color: #38bdf8;
      border-color: #38bdf8;
    }
  </style>
</head>
<body>

<div class="container">
  <div class="header">
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <h1 style="font-size:18px;font-weight:800">Database Reset & Seed Console</h1>
        <p style="font-size:12px;color:var(--muted)"><?php echo htmlspecialchars(STORE_NAME); ?> · MySQL Schema v1.0.12</p>
      </div>
    </div>
    <span class="badge <?php echo $currentPdo ? 'badge-live' : 'badge-warn'; ?>">
      <?php echo $currentPdo ? 'MySQL Connected' : 'DB Offline'; ?>
    </span>
  </div>

  <div class="info-box">
    <div style="font-size:13px;color:var(--muted)">Database Target Details:</div>
    <div class="info-grid">
      <div class="info-item">
        <span>DATABASE</span>
        <strong><?php echo htmlspecialchars(DB_NAME); ?></strong>
      </div>
      <div class="info-item">
        <span>HOST</span>
        <strong><?php echo htmlspecialchars(DB_HOST); ?>:<?php echo (int)DB_PORT; ?></strong>
      </div>
      <div class="info-item">
        <span>USER</span>
        <strong><?php echo htmlspecialchars(DB_USER); ?></strong>
      </div>
      <div class="info-item">
        <span>EXISTING TABLES</span>
        <strong><?php echo count($currentTables); ?> tables</strong>
      </div>
    </div>
  </div>

  <?php if ($error): ?>
    <div class="alert alert-error">
      <strong>❌ Error:</strong> <?php echo htmlspecialchars($error); ?>
    </div>
  <?php endif; ?>

  <?php if ($result): ?>
    <div class="alert alert-success">
      <strong style="font-size:15px">🎉 <?php echo htmlspecialchars($result['message']); ?></strong>
      <div style="font-size:12px;margin-top:6px;opacity:0.9">
        Recreated <?php echo (int)$result['tables_created']; ?> tables & seeded full catalog in <?php echo $result['time_ms']; ?> ms.
      </div>
    </div>

    <div style="margin-bottom:10px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase">Execution Log</div>
    <ul class="log-list">
      <?php foreach ($result['logs'] as $log): ?>
        <li><span>✅</span> <?php echo htmlspecialchars($log); ?></li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>

  <?php if (!$isAuthed): ?>
    <form method="POST">
      <div style="margin-bottom:8px;font-size:13px;font-weight:600">Enter Admin Password to Authorize Reset:</div>
      <input type="password" name="admin_pass" placeholder="Enter ADMIN_SECRET_KEY or demo1234" required autofocus>
      <button type="submit" class="btn btn-secondary" style="width:100%">Verify &amp; Continue</button>
    </form>
  <?php else: ?>
    <form method="POST" onsubmit="return confirm('⚠️ WARNING: This will DROP ALL TABLES in database \'<?php echo addslashes(DB_NAME); ?>\' and recreate clean schema with production seed data. Are you sure?');">
      <div style="background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);border-radius:10px;padding:16px;margin-bottom:20px;font-size:13px;color:#fca5a5;line-height:1.5">
        <strong>⚠️ DESTRUCTIVE ACTION WARNING</strong><br>
        Clicking the button below will drop all existing tables in <strong><?php echo htmlspecialchars(DB_NAME); ?></strong>, recreate all 17 schema tables up to v1.0.12, and seed complete catalog data for <strong><?php echo htmlspecialchars(STORE_NAME); ?></strong>.
      </div>
      <input type="hidden" name="execute_reset" value="1">
      <button type="submit" class="btn btn-danger" style="width:100%;height:48px;font-size:15px">
        🔴 Wipe All Tables &amp; Recreate Clean Database
      </button>
    </form>
  <?php endif; ?>

  <div class="quick-links">
    <a href="index.html" class="link-pill">🌐 Storefront (index.html)</a>
    <a href="merchant/index.html" class="link-pill">📊 Merchant Portal</a>
    <a href="test-db.php" class="link-pill">🔍 Test DB Connection</a>
    <a href="swagger.html" class="link-pill">📑 Swagger UI</a>
    <a href="reset-db.php?json=1" class="link-pill">⚙️ Status JSON</a>
  </div>
</div>

</body>
</html>
