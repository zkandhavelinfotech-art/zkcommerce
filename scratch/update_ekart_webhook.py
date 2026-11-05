import os

api_path = 'zkc/api/services/php/api.php'
with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update $dbOptionalRoutes
old_guard = "$dbOptionalRoutes = ['orders/whatsapp-settings', 'whatsapp/sender', 'whatsapp/sender/test', 'stores/templates', 'products'];"
new_guard = "$dbOptionalRoutes = ['orders/whatsapp-settings', 'whatsapp/sender', 'whatsapp/sender/test', 'stores/templates', 'products', 'shipments/settings', 'webhooks/ekart', 'shipments/ekart/webhook'];"

if old_guard in content:
    content = content.replace(old_guard, new_guard)
    print("Updated $dbOptionalRoutes")
else:
    print("dbOptionalRoutes marker not found or already replaced")

# 2. Update shipments/settings block
old_ship = '''// Shipments / Ekart settings
if ($route === 'shipments/settings') {
    respond([
        'settings' => [
            'enabled' => false,
            'mode' => 'sandbox',
            'courier_name' => 'Ekart Logistics',
            'tracking_url_template' => 'https://ekartlogistics.com/shipmenttrack/{tracking_number}',
            'api' => ['base_url' => '', 'client_id' => '', 'merchant_code' => '', 'has_api_key' => false]
        ]
    ]);
}'''

new_ship = '''// Shipments / Ekart settings
if ($route === 'shipments/settings') {
    $ekClientId = defined('EKART_CLIENT_ID') ? EKART_CLIENT_ID : 'EKART_6ad49aef2206ede3ee46d222';
    $ekAlertEmail = defined('EKART_ALERT_EMAIL') ? EKART_ALERT_EMAIL : 'smeramindustries@gmail.com';
    $ekWebhookSecret = defined('EKART_WEBHOOK_SECRET') ? EKART_WEBHOOK_SECRET : 'ek_sec_984f1801m1z6_smeram';
    $ekWebhookUrl = 'https://smeram-naturals.in/api.php?route=webhooks/ekart';

    if ($method === 'PUT') {
        respond([
            'success' => true,
            'settings' => [
                'enabled' => !empty($body['enabled']),
                'mode' => (string)($body['mode'] ?? 'api'),
                'courier_name' => (string)($body['courier_name'] ?? 'Ekart Logistics'),
                'tracking_url_template' => (string)($body['tracking_url_template'] ?? 'https://ekartlogistics.com/shipmenttrack/{tracking_number}'),
                'api' => [
                    'base_url' => (string)($body['api']['base_url'] ?? 'https://api.ekartlogistics.com'),
                    'client_id' => (string)($body['api']['client_id'] ?? $ekClientId),
                    'merchant_code' => (string)($body['api']['merchant_code'] ?? 'SMERAM'),
                    'has_api_key' => !empty($body['api']['api_key']) || (defined('EKART_API_KEY') && EKART_API_KEY !== ''),
                    'webhook_url' => $ekWebhookUrl,
                    'webhook_secret' => $ekWebhookSecret,
                    'alert_email' => $ekAlertEmail,
                    'topics' => 'shipment.created, shipment.pickup_completed, shipment.in_transit, shipment.out_for_delivery, shipment.delivered, shipment.rto'
                ]
            ]
        ]);
    }
    respond([
        'settings' => [
            'enabled' => defined('EKART_ENABLED') ? (bool)EKART_ENABLED : true,
            'mode' => defined('EKART_MODE') ? EKART_MODE : 'api',
            'courier_name' => defined('SHIP_COURIER') ? SHIP_COURIER : 'Ekart Logistics',
            'tracking_url_template' => defined('SHIP_TRACKING_URL') ? SHIP_TRACKING_URL : 'https://ekartlogistics.com/shipmenttrack/{tracking_number}',
            'api' => [
                'base_url' => defined('EKART_BASE_URL') ? EKART_BASE_URL : 'https://api.ekartlogistics.com',
                'client_id' => $ekClientId,
                'merchant_code' => defined('EKART_MERCHANT_CODE') ? EKART_MERCHANT_CODE : 'SMERAM',
                'has_api_key' => defined('EKART_API_KEY') && EKART_API_KEY !== '',
                'webhook_url' => $ekWebhookUrl,
                'webhook_secret' => $ekWebhookSecret,
                'alert_email' => $ekAlertEmail,
                'topics' => 'shipment.created, shipment.pickup_completed, shipment.in_transit, shipment.out_for_delivery, shipment.delivered, shipment.rto'
            ]
        ]
    ]);
}'''

# Normalize newlines
content_norm = content.replace('\r\n', '\n')
old_ship_norm = old_ship.replace('\r\n', '\n')
if old_ship_norm in content_norm:
    content_norm = content_norm.replace(old_ship_norm, new_ship.replace('\r\n', '\n'))
    print("Replaced shipments/settings block")
else:
    print("Could not find old shipments/settings block")

# 3. Add Ekart Webhook Handler before Razorpay webhook
razor_marker = "// Razorpay webhook\nif ($route === 'payments/razorpay/webhook' && $method === 'POST') {"
ekart_webhook_handler = '''// Ekart Logistics Webhook
if ($route === 'webhooks/ekart' || $route === 'shipments/ekart/webhook') {
    // 1. Handshake verification via GET
    if ($method === 'GET') {
        respond([
            'status' => 'ok',
            'service' => 'Ekart Logistics Webhook Receiver',
            'store' => defined('STORE_NAME') ? STORE_NAME : 'Smeram Naturals',
            'client_id' => defined('EKART_CLIENT_ID') ? EKART_CLIENT_ID : 'EKART_6ad49aef2206ede3ee46d222',
            'alert_email' => defined('EKART_ALERT_EMAIL') ? EKART_ALERT_EMAIL : 'smeramindustries@gmail.com',
            'time' => date('Y-m-d H:i:s')
        ]);
    }

    // 2. Incoming Event processing via POST
    if ($method === 'POST') {
        $secret = defined('EKART_WEBHOOK_SECRET') ? EKART_WEBHOOK_SECRET : 'ek_sec_984f1801m1z6_smeram';

        // Signature check if provided
        $sig = (string)($_SERVER['HTTP_X_EKART_SIGNATURE'] ?? $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? $_SERVER['HTTP_X_HUB_SIGNATURE'] ?? '');
        if ($sig !== '' && $secret !== '') {
            $expected = hash_hmac('sha256', (string)$raw, $secret);
            $cleanSig = preg_replace('/^sha256=/i', '', $sig);
            if (!hash_equals(strtolower($expected), strtolower($cleanSig))) {
                respond(['error' => 'Invalid Ekart webhook signature'], 400);
            }
        }

        $payload = json_decode((string)$raw, true) ?: [];
        if (empty($payload)) {
            $payload = $_POST ?: [];
        }

        $data = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : (isset($payload['payload']) && is_array($payload['payload']) ? $payload['payload'] : $payload);

        $topic = strtolower((string)($payload['topic'] ?? $payload['event'] ?? $payload['event_type'] ?? ($data['topic'] ?? ($data['event'] ?? ''))));
        $awb = trim((string)($data['tracking_id'] ?? $data['awb'] ?? $data['awb_number'] ?? $data['waybill'] ?? $data['tracking_number'] ?? ($payload['tracking_id'] ?? ($payload['awb'] ?? ''))));
        $orderRef = trim((string)($data['client_reference_id'] ?? $data['order_id'] ?? $data['order_number'] ?? $data['reference_id'] ?? ($payload['client_reference_id'] ?? ($payload['order_id'] ?? ''))));
        $statusRaw = strtolower((string)($data['status'] ?? $data['current_status'] ?? ($payload['status'] ?? '')));

        // Map topic/status to canonical order status
        $newStatus = null;
        if (strpos($topic, 'deliver') !== false || strpos($statusRaw, 'deliver') !== false) {
            $newStatus = 'delivered';
        } elseif (strpos($topic, 'transit') !== false || strpos($topic, 'shipped') !== false || strpos($topic, 'pickup') !== false || strpos($topic, 'out_for_delivery') !== false || strpos($statusRaw, 'transit') !== false || strpos($statusRaw, 'shipped') !== false || strpos($statusRaw, 'dispatched') !== false) {
            $newStatus = 'shipped';
        } elseif (strpos($topic, 'rto') !== false || strpos($topic, 'returned') !== false || strpos($topic, 'fail') !== false || strpos($statusRaw, 'rto') !== false || strpos($statusRaw, 'return') !== false) {
            $newStatus = 'returned';
        }

        $updated = false;
        $wa = [];

        if ($pdo && ($orderRef !== '' || $awb !== '')) {
            $tbl = zkcGetOrdersTable($pdo);
            $order = null;
            if ($orderRef !== '') {
                $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE order_number = ? OR id = ? LIMIT 1");
                $stmt->execute([$orderRef, is_numeric($orderRef) ? (int)$orderRef : 0]);
                $order = $stmt->fetch();
            }
            if (!$order && $awb !== '') {
                $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE tracking_number = ? LIMIT 1");
                $stmt->execute([$awb]);
                $order = $stmt->fetch();
            }

            if ($order) {
                $orderId = (int)$order['id'];
                if ($awb !== '' && empty($order['tracking_number']) && function_exists('zkcAssignAwb')) {
                    try {
                        zkcAssignAwb($pdo, $orderId, $awb, 'Ekart Logistics');
                    } catch (Throwable $e) {
                        error_log('[Ekart AWB Assign] ' . $e->getMessage());
                    }
                }

                if ($newStatus && function_exists('zkcChangeStatus')) {
                    try {
                        $res = zkcChangeStatus($pdo, $orderId, $newStatus, $awb ?: ($order['tracking_number'] ?? null));
                        $updated = true;
                        $wa = $res['whatsapp'] ?? [];
                    } catch (Throwable $e) {
                        error_log('[Ekart Status Update] ' . $e->getMessage());
                    }
                }
            }
        }

        respond([
            'success' => true,
            'message' => 'Ekart webhook received',
            'topic' => $topic ?: $statusRaw,
            'awb' => $awb,
            'order_ref' => $orderRef,
            'new_status' => $newStatus,
            'order_updated' => $updated,
            'whatsapp_dispatched' => count($wa) > 0
        ]);
    }
}

'''

if razor_marker in content_norm and "if ($route === 'webhooks/ekart'" not in content_norm:
    content_norm = content_norm.replace(razor_marker, ekart_webhook_handler + razor_marker)
    print("Inserted Ekart Webhook handler")
else:
    print("Razorpay marker not found or Ekart webhook already present")

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("api.php updated successfully")
