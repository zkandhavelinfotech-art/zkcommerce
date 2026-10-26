<?php
/**
 * ZKCommerce / Smeram Naturals — Razorpay Dual Configuration Template (Live & Test)
 * Copy this file to payment_config.php and fill in your values.
 * Change RAZORPAY_MODE to 'live' or 'test' as needed.
 */

// ── Active Mode Selector (Currently: LIVE) ───────────────────
define('RAZORPAY_MODE', 'live'); // Options: 'live' or 'test'

// ── Live Credentials (Domain: smeranm-naturals.in) ───────────
define('RAZORPAY_LIVE_KEY_ID', 'rzp_live_TrzrN3plJPv1lV');
define('RAZORPAY_LIVE_KEY_SECRET', 'LrNPKD7DytSnHcsc5NxQMKCb');
define('RAZORPAY_LIVE_WEBHOOK_SECRET', 'smeram_live_webhook_secret_2026');
define('RAZORPAY_LIVE_DOMAIN', 'smeranm-naturals.in');
define('RAZORPAY_LIVE_WEBHOOK_URL', 'https://smeranm-naturals.in/api.php?route=payments/razorpay/webhook');

// ── Test Credentials (Domain: localhost:3000) ─────────────────
define('RAZORPAY_TEST_KEY_ID', 'rzp_test_your_key_id');
define('RAZORPAY_TEST_KEY_SECRET', 'your_razorpaay_key_secret');
define('RAZORPAY_TEST_WEBHOOK_SECRET', 'smeram_test_webhook_secret_2026');
define('RAZORPAY_TEST_DOMAIN', 'localhost:3000');
define('RAZORPAY_TEST_WEBHOOK_URL', 'http://localhost:3000/api.php?route=payments/razorpay/webhook');

// ── Active Key Resolution ─────────────────────────────────────
if (RAZORPAY_MODE === 'live') {
    define('RAZORPAY_KEY_ID', RAZORPAY_LIVE_KEY_ID);
    define('RAZORPAY_KEY_SECRET', RAZORPAY_LIVE_KEY_SECRET);
    define('RAZORPAY_WEBHOOK_SECRET', RAZORPAY_LIVE_WEBHOOK_SECRET);
    define('RAZORPAY_DOMAIN', RAZORPAY_LIVE_DOMAIN);
    define('RAZORPAY_WEBHOOK_URL', RAZORPAY_LIVE_WEBHOOK_URL);
} else {
    define('RAZORPAY_KEY_ID', RAZORPAY_TEST_KEY_ID);
    define('RAZORPAY_KEY_SECRET', RAZORPAY_TEST_KEY_SECRET);
    define('RAZORPAY_WEBHOOK_SECRET', RAZORPAY_TEST_WEBHOOK_SECRET);
    define('RAZORPAY_DOMAIN', RAZORPAY_TEST_DOMAIN);
    define('RAZORPAY_WEBHOOK_URL', RAZORPAY_TEST_WEBHOOK_URL);
}

/**
 * Razorpay Dashboard Webhook Configuration:
 * 1. Go to: Razorpay Dashboard → Settings → Webhooks → Add New Webhook
 * 2. Webhook URL:
 *    - Live: https://smeranm-naturals.in/api.php?route=payments/razorpay/webhook
 *    - Test: http://localhost:3000/api.php?route=payments/razorpay/webhook
 * 3. Secret: Value of RAZORPAY_WEBHOOK_SECRET defined above
 * 4. Active Events:
 *    - payment.captured
 *    - payment.failed
 */
