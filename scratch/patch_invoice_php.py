with open('zkc/api/services/php/invoice.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_str = "$o = zkcOrderById($pdo, $orderId);\nif (!$o) { http_response_code(404); exit('Order not found'); }"
new_str = """$o = zkcOrderById($pdo, $orderId);
if (!$o) { http_response_code(404); exit('Order not found'); }

$payStatus = strtolower((string)($o['payment_status'] ?? ''));
$ordStatus = strtolower((string)($o['order_status'] ?? ($o['status'] ?? '')));
$payMethod = strtolower((string)($o['payment_method'] ?? ''));
$isPaidOrConfirmed = ($payStatus === 'paid' || in_array($ordStatus, ['confirmed', 'processing', 'shipped', 'delivered']) || ($payMethod === 'cod' && $ordStatus !== 'cancelled'));
if (!$isPaidOrConfirmed) {
    http_response_code(400);
    exit('Tax invoices are generated only for paid or confirmed orders. Current order payment status is ' . ($payStatus ?: 'unpaid') . '.');
}"""

if old_str in code:
    code = code.replace(old_str, new_str, 1)
    with open('zkc/api/services/php/invoice.php', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: invoice.php updated!")
else:
    print("ERROR: old_str not found")

