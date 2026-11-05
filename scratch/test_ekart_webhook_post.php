<?php
// Test 3: POST webhooks/ekart with event payload
$_SERVER['REQUEST_METHOD'] = 'POST';
$_GET['route'] = 'webhooks/ekart';
$payload = json_encode([
    'topic' => 'shipment.in_transit',
    'awb' => 'EK987654321IN',
    'client_reference_id' => 'ZK1001',
    'status' => 'IN_TRANSIT'
]);

// Set up mock php://input
$GLOBALS['zkc_test_raw_input'] = $payload;

ob_start();
// In api.php, $raw comes from file_get_contents('php://input');
// If $raw is empty in CLI, it falls back to empty or $_POST
$_POST = json_decode($payload, true);
require __DIR__ . '/../zkc/api/services/php/api.php';
$out3 = ob_get_clean();
echo "--- TEST 3: POST webhooks/ekart ---\n" . $out3 . "\n\n";

