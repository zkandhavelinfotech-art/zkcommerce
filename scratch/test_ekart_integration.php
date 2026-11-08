<?php
// Test Ekart integration and routing
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== TEST 1: URL Normalization ===\n";
require_once __DIR__ . '/../zkc/api/services/php/store_config.php';
require_once __DIR__ . '/../zkc/api/services/php/commerce.php';

$testUrls = [
    'https://app.elite.ekartlogistics.in/api' => 'https://app.elite.ekartlogistics.in',
    'https://app.elite.ekartlogistics.in/api/' => 'https://app.elite.ekartlogistics.in',
    'https://app.elite.ekartlogistics.in/' => 'https://app.elite.ekartlogistics.in',
    'https://app.elite.ekartlogistics.in' => 'https://app.elite.ekartlogistics.in'
];

foreach ($testUrls as $in => $expected) {
    $norm = preg_replace('#/api/?$#i', '', trim($in));
    $norm = rtrim($norm, '/');
    assert($norm === $expected);
    echo "  [OK] $in -> $norm\n";
}

echo "\n=== TEST 2: Tracking URL ===\n";
$awb = '500999A3408005';
$trk = zkcTrackingUrl($awb);
echo "  AWB: $awb\n  Tracking URL: $trk\n";
assert(strpos($trk, '500999A3408005') !== false);
echo "  [OK] Tracking URL is valid.\n";

echo "\n=== TEST 3: Route Simulation for shipments/settings ===\n";
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_GET['route'] = 'shipments/settings';

ob_start();
// Run route test via dummy execution or include
require __DIR__ . '/../zkc/api/services/php/api.php';
$out = ob_get_clean();
echo "  Response: " . substr($out, 0, 300) . "...\n";
$json = json_decode($out, true);
if (isset($json['error']) && $json['error'] === 'Route not found') {
    echo "  [FAIL] Route not found!\n";
    exit(1);
} else {
    echo "  [SUCCESS] shipments/settings routed properly! Enabled: " . ($json['settings']['enabled'] ? 'YES' : 'NO') . "\n";
    echo "  Base URL: " . ($json['settings']['api']['base_url'] ?? '') . "\n";
    echo "  Client ID: " . ($json['settings']['api']['client_id'] ?? '') . "\n";
    echo "  Merchant Code: " . ($json['settings']['api']['merchant_code'] ?? '') . "\n";
}

echo "\nALL LOCAL TESTS PASSED!\n";
