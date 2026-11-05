with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_pdf_route = '''if (preg_match('#^invoices/(\d+)/pdf$#', $route, $m) && $method === 'GET') {
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
}'''

new_pdf_route = '''if (preg_match('#^invoices/(\d+)/pdf$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $_GET['id'] = $orderId;
    if (is_file(__DIR__ . '/invoice.php')) {
        require __DIR__ . '/invoice.php';
        exit;
    }
    respond(['error' => 'Invoice template not found'], 404);
}'''

if old_pdf_route in code:
    code = code.replace(old_pdf_route, new_pdf_route, 1)
    with open('zkc/api/services/php/api.php', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: api.php updated to render invoice.php on /invoices/:id/pdf route!")
else:
    print("ERROR: old_pdf_route not found in api.php")

