with open('zkc/api/services/php/order.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_block = """        $payStatus = !empty($data['payment_status']) ? trim($data['payment_status']) : (($method === 'razorpay') ? 'paid' : 'pending');
        $rzpPaymentId = trim($data['razorpay_payment_id'] ?? '');
        $rzpOrderId = trim($data['razorpay_order_id'] ?? '');
        $rzpSig = trim($data['razorpay_signature'] ?? '');
        if ($rzpPaymentId !== '') {
            $notes = trim($notes . ' [Razorpay Payment ID: ' . $rzpPaymentId . ']');
        }

        $hasStoreId = true;
        try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }

        if ($hasStoreId) {
            $stmt = $pdo->prepare("
                INSERT INTO `{$tbl}` 
                (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, subtotal, discount_amount, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, notes)
                VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
            ");
            $stmt->execute([
                $orderNum, $name, $phone, $email, $address, $city, $state, $pincode, $itemsJson,
                $subtotal, $discount, $shipping, $total, $method, $payStatus,
                $rzpOrderId ?: null, $rzpPaymentId ?: null, $rzpSig ?: null, $notes
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO `{$tbl}` 
                (order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, subtotal, discount_amount, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
            ");
            $stmt->execute([
                $orderNum, $name, $phone, $email, $address, $city, $state, $pincode, $itemsJson,
                $subtotal, $discount, $shipping, $total, $method, $payStatus,
                $rzpOrderId ?: null, $rzpPaymentId ?: null, $rzpSig ?: null, $notes
            ]);
        }"""

new_block = """        $payStatus = !empty($data['payment_status']) ? trim($data['payment_status']) : (($method === 'razorpay') ? 'paid' : 'pending');
        $ordStatus = ($payStatus === 'paid' || $method === 'cod') ? 'confirmed' : 'pending';
        $rzpPaymentId = trim($data['razorpay_payment_id'] ?? '');
        $rzpOrderId = trim($data['razorpay_order_id'] ?? '');
        $rzpSig = trim($data['razorpay_signature'] ?? '');
        if ($rzpPaymentId !== '') {
            $notes = trim($notes . ' [Razorpay Payment ID: ' . $rzpPaymentId . ']');
        }

        $hasStoreId = true;
        try { $pdo->query("SELECT store_id FROM `{$tbl}` LIMIT 1"); } catch (Exception $e) { $hasStoreId = false; }

        if ($hasStoreId) {
            $stmt = $pdo->prepare("
                INSERT INTO `{$tbl}` 
                (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, subtotal, discount_amount, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, notes)
                VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $orderNum, $name, $phone, $email, $address, $city, $state, $pincode, $itemsJson,
                $subtotal, $discount, $shipping, $total, $method, $payStatus, $ordStatus,
                $rzpOrderId ?: null, $rzpPaymentId ?: null, $rzpSig ?: null, $notes
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO `{$tbl}` 
                (order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, subtotal, discount_amount, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $orderNum, $name, $phone, $email, $address, $city, $state, $pincode, $itemsJson,
                $subtotal, $discount, $shipping, $total, $method, $payStatus, $ordStatus,
                $rzpOrderId ?: null, $rzpPaymentId ?: null, $rzpSig ?: null, $notes
            ]);
        }"""

if old_block in code:
    code = code.replace(old_block, new_block, 1)
    with open('zkc/api/services/php/order.php', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: order.php updated!")
else:
    print("ERROR: old_block not found in order.php")

