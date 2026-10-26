<?php
/**
 * Merchant order dashboard for PHP + MySQL hosting. Password: ADMIN_SECRET_KEY in db_config.php.
 * Status changes move stock (cancel/return puts it back) and send the shipped / delivered WhatsApp, like the Node dashboard.
 */
require_once __DIR__ . '/admin_common.php';

$error = '';
$message = '';
$waLinks = [];
$pages = ['packaging' => 'packaging.php', 'shipments' => 'shipments.php', 'stock' => 'stock.php', 'customers' => 'customers.php', 'coupons' => 'coupons.php', 'invoice' => 'invoice.php'];

if (isset($_POST['login_pass'])) {
    if (hash_equals((string)ADMIN_SECRET_KEY, (string)$_POST['login_pass'])) {
        session_regenerate_id(true);
        $_SESSION['zkc_admin'] = STORE_ID;
        $next = (string)($_GET['next'] ?? '');
        $base = strtok($next, '?');
        if (isset($pages[$base])) { header('Location: ' . $pages[$base] . (strpos($next, '?') !== false ? substr($next, strpos($next, '?')) : '')); exit; }
    }
    else $error = 'Invalid password.';
}
if (isset($_GET['logout'])) { session_destroy(); header('Location: admin-orders.php'); exit; }

$isLoggedIn = zkcIsAdmin();
$pdo = $isLoggedIn ? getDbConnection() : null;
if ($isLoggedIn && !$pdo) $error = 'Could not connect to MySQL. Check db_config.php.';
if ($pdo) { try { $pdo->exec("SET time_zone = '+05:30'"); } catch (Exception $e) { /* keep the server default */ } }

if ($pdo && ($_POST['action'] ?? '') === 'update_status') {
    if (!zkcCsrfOk()) $error = 'Your session expired. Please try again.';
    else {
        try {
            $r = zkcChangeStatus($pdo, (int)$_POST['order_id'], (string)($_POST['new_status'] ?? ''), trim((string)($_POST['awb'] ?? '')));
            $message = 'Order ' . $r['order']['order_number'] . ' updated to ' . strtoupper($r['order']['order_status']);
            foreach ($r['whatsapp'] as $w) {
                if ($w['status'] === 'sent') $message .= ' · WhatsApp sent to the customer';
                elseif (!empty($w['wa_link'])) $waLinks[] = $w['wa_link'];
            }
        } catch (Exception $e) { $error = $e->getMessage(); }
    }
}

$orders = [];
$revenue = 0;
$filter = in_array($_GET['status'] ?? '', ZKC_STATUSES, true) ? $_GET['status'] : '';
$q = trim((string)($_GET['q'] ?? ''));
if ($pdo) {
    $sql = 'SELECT o.*, i.invoice_number FROM orders o LEFT JOIN invoices i ON i.order_id = o.id WHERE o.store_id = ?';
    $args = [STORE_ID];
    if ($filter !== '') { $sql .= ' AND o.order_status = ?'; $args[] = $filter; }
    if ($q !== '') { $sql .= ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.tracking_number LIKE ?)'; array_push($args, "%$q%", "%$q%", "%$q%", "%$q%"); }
    $stmt = $pdo->prepare($sql . ' ORDER BY o.id DESC LIMIT 300');
    $stmt->execute($args);
    $orders = $stmt->fetchAll();
    // Revenue counts only money that is in or due: COD orders and paid online orders.
    foreach ($orders as $o) if (!in_array($o['order_status'], ['cancelled', 'returned'], true) && in_array($o['payment_status'], ['cod', 'paid'], true)) $revenue += (float)$o['total_amount'];
}
$csrf = zkcCsrf();
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h(STORE_NAME) ?> — Orders</title>
<?= zkcAdminStyles() ?>
</head><body><div class="wrap">
<?php if (!$isLoggedIn): ?>
  <div class="card" style="max-width:380px;margin:60px auto"><h1><?= h(STORE_NAME) ?> — Orders</h1>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <form method="post"><p><input type="password" name="login_pass" placeholder="Admin password" required style="width:100%"></p><button>Sign in</button></form></div>
<?php else: ?>
  <?= zkcAdminHeader('orders', count($orders) . ' orders · ₹' . number_format($revenue, 2) . ' ·') ?>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <?php if ($message): ?><p class="ok"><?= h($message) ?></p><?php endif; ?>
  <?php foreach ($waLinks as $l): ?><p><a class="wa" href="<?= h($l) ?>" target="_blank" rel="noopener">Send the WhatsApp update to the customer</a></p><?php endforeach; ?>
  <form class="card" method="get" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <input name="q" value="<?= h($q) ?>" placeholder="Order, name, phone or AWB">
    <select name="status"><option value="">All statuses</option><?php foreach (ZKC_STATUSES as $s): ?><option value="<?= $s ?>" <?= $filter === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option><?php endforeach; ?></select>
    <button>Filter</button>
  </form>
  <div class="card scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Address</th><th>Items</th><th>Total</th><th>Payment</th><th>Shipping</th><th>Status</th></tr></thead><tbody>
  <?php foreach ($orders as $o): $items = zkcOrderItems($o); ?>
    <tr><td><strong><?= h($o['order_number']) ?></strong><br><small><?= h($o['created_at']) ?></small>
      <?php if (in_array($o['payment_status'], ['paid', 'cod'], true) && !in_array($o['order_status'], ['pending', 'cancelled', 'returned'], true)): ?><br><a href="invoice.php?id=<?= (int)$o['id'] ?>" target="_blank"><?= $o['invoice_number'] ? h($o['invoice_number']) : 'Invoice' ?></a><?php endif; ?></td>
    <td><?= h($o['customer_name']) ?><br><?= h($o['customer_phone']) ?><br><small><?= h($o['customer_email']) ?></small></td>
    <td><?= h($o['shipping_address']) ?><br><?= h(trim($o['city'] . ', ' . $o['state'] . ' ' . $o['pincode'], ', ')) ?></td>
    <td><?php foreach ($items as $i): ?><?= h($i['name'] ?? '') ?><?= !empty($i['size']) ? ' (' . h($i['size']) . ')' : '' ?> × <?= (int)($i['quantity'] ?? 1) ?><br><?php endforeach; ?></td>
    <td>₹<?= number_format((float)$o['total_amount'], 2) ?>
      <?php if ((float)$o['discount_amount'] > 0): ?><br><small class="muted">−₹<?= number_format((float)$o['discount_amount'], 2) ?> <?= h($o['coupon_code']) ?></small><?php endif; ?>
      <?php if ((float)$o['gst_amount'] > 0): ?><br><small class="muted">GST ₹<?= number_format((float)$o['gst_amount'], 2) ?></small><?php endif; ?>
      <?php if ((float)$o['shipping_amount'] > 0): ?><br><small class="muted">Shipping ₹<?= number_format((float)$o['shipping_amount'], 2) ?></small><?php endif; ?></td>
    <td><?= h(strtoupper($o['payment_method'])) ?><br><small class="<?= $o['payment_status'] === 'paid' ? 'ok' : ($o['payment_status'] === 'failed' ? 'err' : '') ?>"><?= h($o['payment_status']) ?></small></td>
    <td><?php if ($o['tracking_number']): ?><?= h($o['courier'] ?: 'AWB') ?> <b><?= h($o['tracking_number']) ?></b><?php if ($o['tracking_url']): ?><br><a href="<?= h($o['tracking_url']) ?>" target="_blank" rel="noopener">Track ↗</a><?php endif; ?><?php else: ?><span class="muted">—</span><?php endif; ?></td>
    <td><form method="post"><input type="hidden" name="action" value="update_status"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="order_id" value="<?= (int)$o['id'] ?>">
      <select name="new_status"><?php foreach (ZKC_STATUSES as $s): ?><option value="<?= $s ?>" <?= $o['order_status'] === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option><?php endforeach; ?></select>
      <?php if (!$o['tracking_number'] && in_array($o['order_status'], ['new', 'processing'], true)): ?><input name="awb" placeholder="AWB (optional)" size="12"><?php endif; ?>
      <button class="light">Save</button></form></td></tr>
  <?php endforeach; ?>
  <?php if (!$orders): ?><tr><td colspan="8">No orders yet.</td></tr><?php endif; ?>
  </tbody></table></div>
<?php endif; ?>
</div></body></html>
