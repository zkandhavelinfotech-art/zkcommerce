with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

start_tag = '// Invoices list & retrieval'
end_tag = '// Customers list for merchant dashboard'

idx1 = code.find(start_tag)
idx2 = code.find(end_tag)

if idx1 == -1 or idx2 == -1:
    print(f"Error: tags not found. idx1={idx1}, idx2={idx2}")
    exit(1)

new_block = '''// Invoices list & retrieval (Only paid or confirmed orders generate tax invoices)
if ($route === 'invoices' && $method === 'GET') {
    $invoices = [];
    if ($pdo) {
        $tbl = zkcGetOrdersTable($pdo);
        try {
            $hasStoreId = true;
            try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }
            $where = [];
            $params = [];
            if ($hasStoreId) {
                $where[] = "store_id = ?";
                $params[] = (int)STORE_ID;
            }
            // CRITICAL: Invoices are strictly generated for paid, confirmed, or valid COD orders only!
            $where[] = "(payment_status = 'paid' OR order_status IN ('confirmed', 'processing', 'shipped', 'delivered') OR (payment_method = 'cod' AND order_status != 'cancelled'))";
            
            $q = trim((string)($_GET['q'] ?? ''));
            if ($q !== '') {
                $where[] = "(order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)";
                $like = '%' . $q . '%';
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }
            $sqlWhere = !empty($where) ? ('WHERE ' . implode(' AND ', $where)) : '';
            $stmt = $pdo->prepare("SELECT id, order_number, customer_name, customer_email, customer_phone, total_amount, payment_method, payment_status, order_status AS status, created_at AS issued_at, CONCAT('ZK-2-', id) AS invoice_number FROM `{$tbl}` {$sqlWhere} ORDER BY id DESC LIMIT 100");
            $stmt->execute($params);
            if ($stmt) $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Exception $e) {}
    }
    respond(['invoices' => $invoices]);
}
if (preg_match('#^invoices/(\d+)$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $o = function_exists('zkcOrderById') ? zkcOrderById($pdo, $orderId) : null;
    if (!$o) respond(['error' => 'Invoice not found'], 404);
    $payStatus = strtolower((string)($o['payment_status'] ?? ''));
    $ordStatus = strtolower((string)($o['order_status'] ?? ($o['status'] ?? '')));
    $payMethod = strtolower((string)($o['payment_method'] ?? ''));
    $isPaidOrConfirmed = ($payStatus === 'paid' || in_array($ordStatus, ['confirmed', 'processing', 'shipped', 'delivered']) || ($payMethod === 'cod' && $ordStatus !== 'cancelled'));
    if (!$isPaidOrConfirmed) {
        respond(['error' => 'Invoices can only be viewed for paid or confirmed orders.'], 400);
    }
    $invNum = 'ZK-' . (defined('STORE_ID') ? STORE_ID : 2) . '-' . $orderId;
    respond(['invoice' => array_merge($o, ['invoice_number' => $invNum, 'issued_at' => $o['created_at'] ?? date('Y-m-d H:i:s')])]);
}
if (preg_match('#^invoices/(\d+)$#', $route, $m) && $method === 'POST') {
    $orderId = (int)$m[1];
    $o = function_exists('zkcOrderById') ? zkcOrderById($pdo, $orderId) : null;
    if (!$o) {
        $tbl = zkcGetOrdersTable($pdo);
        $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE id = ?");
        $stmt->execute([$orderId]);
        $o = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$o) respond(['error' => 'Order not found'], 404);
    $payStatus = strtolower((string)($o['payment_status'] ?? ''));
    $ordStatus = strtolower((string)($o['order_status'] ?? ($o['status'] ?? '')));
    $payMethod = strtolower((string)($o['payment_method'] ?? ''));
    $isPaidOrConfirmed = ($payStatus === 'paid' || in_array($ordStatus, ['confirmed', 'processing', 'shipped', 'delivered']) || ($payMethod === 'cod' && $ordStatus !== 'cancelled'));
    if (!$isPaidOrConfirmed) {
        respond(['error' => 'Invoices can only be generated for paid or confirmed orders.'], 400);
    }
    $invNum = 'ZK-' . (defined('STORE_ID') ? STORE_ID : 2) . '-' . $orderId;
    respond(['success' => true, 'invoice' => ['id' => $orderId, 'invoice_number' => $invNum]]);
}
if (preg_match('#^invoices/(\d+)/pdf$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $o = function_exists('zkcOrderById') ? zkcOrderById($pdo, $orderId) : null;
    if (!$o) {
        $tbl = zkcGetOrdersTable($pdo);
        $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE id = ?");
        $stmt->execute([$orderId]);
        $o = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$o) {
        http_response_code(404);
        exit('Order not found');
    }
    $payStatus = strtolower((string)($o['payment_status'] ?? ''));
    $ordStatus = strtolower((string)($o['order_status'] ?? ($o['status'] ?? '')));
    $payMethod = strtolower((string)($o['payment_method'] ?? ''));
    $isPaidOrConfirmed = ($payStatus === 'paid' || in_array($ordStatus, ['confirmed', 'processing', 'shipped', 'delivered']) || ($payMethod === 'cod' && $ordStatus !== 'cancelled'));
    if (!$isPaidOrConfirmed) {
        http_response_code(400);
        exit('Invoices can only be downloaded for paid or confirmed orders. Current order status is ' . ($payStatus ?: 'unpaid') . '.');
    }
    $invNum = 'ZK-' . (defined('STORE_ID') ? STORE_ID : 2) . '-' . $orderId;
    $cust = trim((string)($o['customer_name'] ?? 'Customer'));
    $phone = trim((string)($o['customer_phone'] ?? ''));
    $email = trim((string)($o['customer_email'] ?? ''));
    $addr = trim((string)($o['shipping_address'] ?? ($o['address'] ?? '')));
    $city = trim((string)($o['city'] ?? ''));
    $state = trim((string)($o['state'] ?? 'Tamil Nadu'));
    $pin = trim((string)($o['pincode'] ?? ''));
    $addrFull = implode(', ', array_filter([$addr, $city, ($state . ($pin ? ' ' . $pin : ''))]));
    
    $items = function_exists('zkcOrderItems') ? zkcOrderItems($o) : [];
    $lines = [
        'TAX INVOICE - ' . (defined('STORE_NAME') ? STORE_NAME : 'Smeram Naturals'),
        'Invoice Number: ' . $invNum . '    Date: ' . date('d M Y', strtotime($o['created_at'] ?? 'now')),
        'Order ID: ' . ($o['order_number'] ?: ('#' . $orderId)),
        '--------------------------------------------------------------------------------',
        'Store: ' . (defined('STORE_NAME') ? STORE_NAME : 'Smeram Naturals'),
        'Address: ' . (defined('STORE_ADDRESS') ? STORE_ADDRESS : '') . ', ' . (defined('STORE_CITY') ? STORE_CITY : 'Chennai') . ', ' . (defined('STORE_STATE') ? STORE_STATE : 'Tamil Nadu'),
        'Phone: ' . (defined('STORE_PHONE') ? STORE_PHONE : '+91 75399 72026'),
        '--------------------------------------------------------------------------------',
        'BILL TO / SHIP TO:',
        'Name: ' . $cust,
        'Phone: ' . $phone . ($email ? ' | Email: ' . $email : ''),
        'Address: ' . ($addrFull ?: 'Address on file'),
        '--------------------------------------------------------------------------------',
        'ITEMS ORDERED:'
    ];
    if (!empty($items)) {
        foreach ($items as $idx => $it) {
            $name = $it['name'] . (!empty($it['size']) ? ' (' . $it['size'] . ')' : '');
            $qty = (int)($it['quantity'] ?? 1);
            $pr = number_format((float)($it['price'] ?? 0), 2);
            $amt = number_format((float)($it['price'] ?? 0) * $qty, 2);
            $lines[] = sprintf("%d. %s  x%d @ INR %s = INR %s", $idx + 1, $name, $qty, $pr, $amt);
        }
    } else {
        $lines[] = '1. Order Items x 1 @ INR ' . number_format((float)($o['total_amount'] ?? 0), 2);
    }
    $lines[] = '--------------------------------------------------------------------------------';
    $lines[] = 'Subtotal: INR ' . number_format((float)($o['subtotal'] ?? $o['total_amount']), 2);
    if ((float)($o['discount_amount'] ?? 0) > 0) {
        $lines[] = 'Discount: -INR ' . number_format((float)$o['discount_amount'], 2);
    }
    if ((float)($o['shipping_amount'] ?? 0) > 0) {
        $lines[] = 'Shipping: INR ' . number_format((float)$o['shipping_amount'], 2);
    }
    $lines[] = 'TOTAL AMOUNT: INR ' . number_format((float)($o['total_amount'] ?? 0), 2);
    $payRef = !empty($o['razorpay_payment_id']) ? (' [Ref: ' . $o['razorpay_payment_id'] . ']') : '';
    $lines[] = 'Payment Mode: ' . (strtoupper($o['payment_method'] ?? 'ONLINE')) . ' (' . strtoupper($o['payment_status'] ?? 'PAID') . ')' . $payRef;
    $lines[] = '--------------------------------------------------------------------------------';
    $lines[] = 'Thank you for shopping with ' . (defined('STORE_NAME') ? STORE_NAME : 'Smeram Naturals') . '!';
    $lines[] = 'This is a computer-generated tax invoice.';

    $pdf = zkcMakePdf($lines);
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $invNum . '.pdf"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
    exit;
}

'''

final_code = code[:idx1] + new_block + code[idx2:]
with open('zkc/api/services/php/api.php', 'w', encoding='utf-8') as f:
    f.write(final_code)

print("SUCCESS: api.php updated cleanly!")
