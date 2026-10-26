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
define('WA_CARE_NUMBER', '917539972026');
define('WA_CARE_LABEL', 'Smeram Customer Care');
define('WA_CARE_TEMPLATE', "🛍️ *New Order — {store_name}*\n*Order ID:* {order_id}\n*Name:* {customer_name}\n*Phone:* {customer_phone}\n\n*Products:*\n{products}\n\n*Total:* {total} ({payment_method})\n*Address:* {address}\n*Date:* {order_date} {order_time}");
define('WA_CUSTOMER_TEMPLATE', "Hello {customer_name}, thank you for shopping with {store_name}! 🙏\nYour order *{order_id}* ({total}) is confirmed.\n\n{products}\n\nDelivery to: {address}\nWe will share tracking details once it ships.");
define('WA_LOW_STOCK_TEMPLATE', "⚠️ *Low stock — {store_name}*\n{product_name} {variant}\nOnly *{stock_left}* left (alert level {threshold}).\nRestock soon to avoid missing orders.");
define('WA_SHIPPED_TEMPLATE', "🚚 Hello {customer_name}, your {store_name} order *{order_id}* has shipped with {courier}.\nTrack it here: {tracking_url}");
define('WA_DELIVERED_TEMPLATE', "✅ Hello {customer_name}, your {store_name} order *{order_id}* has been delivered.\nThank you for shopping with us! Reply here if anything is not right.");

// GST
define('GST_ENABLED', false);
define('GST_RATE', 0);

// Admin portal authentication credentials
if (!defined('ADMIN_SECRET_KEY')) define('ADMIN_SECRET_KEY', 'ZKCommerce@Admin2026!');
if (!defined('ADMIN_PASSWORD')) define('ADMIN_PASSWORD', 'demo1234');
