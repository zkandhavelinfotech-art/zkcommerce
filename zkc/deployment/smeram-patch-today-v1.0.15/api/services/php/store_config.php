<?php
/**
 * Smeram Naturals — Store identity and checkout configuration for PHP hosting.
 * Used by api.php and admin-orders.php on GoDaddy.
 */
define('STORE_ID', 2);
define('STORE_SLUG', 'smeram');
define('STORE_NAME', 'Smeram Naturals');
define('STORE_ENV', 'production');
define('STORE_DOMAIN', 'smeram-naturals.in');
define('API_BASE', 'https://smeram-naturals.in/api');
define('PACKAGE_VERSION', '1.0.12');

// "From" address on packaging labels
define('STORE_ADDRESS', '22/13 Rajaveedhi Street, Choolaimedu');
define('STORE_CITY', 'Chennai');
define('STORE_STATE', 'Tamil Nadu');
define('STORE_PHONE', '+91 75399 72026');

// Checkout options
define('CHECKOUT_COD', false);
define('CHECKOUT_RAZORPAY', true);
define('CHECKOUT_COUPON', false);

// WhatsApp order message settings
define('WA_ENABLED', true);
define('WA_HANDOFF', true);
define('WA_AUTO_REDIRECT', true); // Option 1: Automatically redirect customer to WhatsApp chat upon order confirmation
define('WA_CARE_NUMBER', '917539972026');
define('WA_CARE_LABEL', 'Smeram Customer Care');
define('WA_CARE_TEMPLATE', "🛍️ *New Order — {store_name}*\n*Order ID:* {order_id}\n*Name:* {customer_name}\n*Phone:* {customer_phone}\n\n*Products:*\n{products}\n\n*Total:* {total} ({payment_method})\n*Address:* {address}\n*Date:* {order_date} {order_time}");
define('WA_CUSTOMER_TEMPLATE', "Hello {customer_name}, thank you for shopping with {store_name}! 🙏\nYour order *{order_id}* ({total}) is confirmed.\n\n{products}\n\nDelivery to: {address}\nWe will share tracking details once it ships.");

// Option 2: ZKWAConnect Direct Background Webhook Alert to Store Owner
if (!defined('ZKWA_ALERT_ENABLED')) define('ZKWA_ALERT_ENABLED', true);
if (!defined('ZKWA_WEBHOOK_URL')) define('ZKWA_WEBHOOK_URL', ''); // Paste your ZKWAConnect webhook URL here
if (!defined('ZKWA_API_KEY')) define('ZKWA_API_KEY', '');
define('WA_LOW_STOCK_TEMPLATE', "⚠️ *Low stock — {store_name}*\n{product_name} {variant}\nOnly *{stock_left}* left (alert level {threshold}).\nRestock soon to avoid missing orders.");
define('WA_SHIPPED_TEMPLATE', "🚚 Hello {customer_name}, your {store_name} order *{order_id}* has shipped with {courier}.\nTrack it here: {tracking_url}");
define('WA_DELIVERED_TEMPLATE', "✅ Hello {customer_name}, your {store_name} order *{order_id}* has been delivered.\nThank you for shopping with us! Reply here if anything is not right.");

// Billing Entity & GST details (Smeram Industries)
if (!defined('BILLING_NAME')) define('BILLING_NAME', 'Smeram Industries');
if (!defined('GSTIN')) define('GSTIN', '33DVRPR1801M1Z6');
if (!defined('GST_ENABLED')) define('GST_ENABLED', true);
if (!defined('GST_RATE')) define('GST_RATE', 5);

// Admin portal authentication credentials
if (!defined('ADMIN_SECRET_KEY')) define('ADMIN_SECRET_KEY', 'ZKCommerce@Admin2026!');
if (!defined('ADMIN_PASSWORD')) define('ADMIN_PASSWORD', 'demo1234');

// Ekart Logistics & Webhook Configuration (OpenAPI 3.1 spec aligned)
if (!defined('EKART_ENABLED')) define('EKART_ENABLED', true);
if (!defined('EKART_MODE')) define('EKART_MODE', 'api');
if (!defined('EKART_CLIENT_ID')) define('EKART_CLIENT_ID', 'EKART_6ad49aef2206ede3ee46d222');
if (!defined('EKART_MERCHANT_CODE')) define('EKART_MERCHANT_CODE', 'SMERAMx');
if (!defined('EKART_ALERT_EMAIL')) define('EKART_ALERT_EMAIL', 'smeramindustries@gmail.com');
if (!defined('EKART_WEBHOOK_SECRET')) define('EKART_WEBHOOK_SECRET', 'ek_sec_984f1801m1z6_smeram');
if (!defined('EKART_BASE_URL')) define('EKART_BASE_URL', 'https://app.elite.ekartlogistics.in');
if (!defined('EKART_USERNAME')) define('EKART_USERNAME', 'smeramindustries@gmail.com');
if (!defined('EKART_PASSWORD')) define('EKART_PASSWORD', '');
if (!defined('SHIP_COURIER')) define('SHIP_COURIER', 'Ekart Logistics');
if (!defined('SHIP_TRACKING_URL')) define('SHIP_TRACKING_URL', 'https://app.elite.ekartlogistics.in/track/{awb}');
if (!defined('EKART_PORTAL_URL')) define('EKART_PORTAL_URL', 'https://app.elite.ekartlogistics.in/');
if (!defined('EKART_TRACK_PORTAL_URL')) define('EKART_TRACK_PORTAL_URL', 'https://ekartlogistics.com/ekartlogistics-web/');
