<?php
// Test 2: GET webhooks/ekart (handshake)
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['route'] = 'webhooks/ekart';
ob_start();
require __DIR__ . '/../zkc/api/services/php/api.php';
$out2 = ob_get_clean();
echo "--- TEST 2: GET webhooks/ekart ---\n" . $out2 . "\n\n";

