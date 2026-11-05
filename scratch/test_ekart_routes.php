<?php
// Test 1: GET shipments/settings
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['route'] = 'shipments/settings';
ob_start();
require __DIR__ . '/../zkc/api/services/php/api.php';
$out1 = ob_get_clean();
echo "--- TEST 1: GET shipments/settings ---\n" . $out1 . "\n\n";

