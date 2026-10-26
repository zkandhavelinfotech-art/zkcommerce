<?php
/** Customers on the PHP site: one row per phone number, built from orders. ?format=csv downloads the list. */
require_once __DIR__ . '/admin_common.php';
$pdo = zkcRequireAdmin('customers');

$q = trim((string)($_GET['q'] ?? ''));
$sql = "SELECT customer_phone, MAX(customer_name) AS customer_name, MAX(customer_email) AS customer_email, MAX(city) AS city, MAX(state) AS state,
          COUNT(*) AS orders, SUM(CASE WHEN order_status NOT IN ('cancelled','returned','pending') AND payment_status IN ('paid','cod') THEN total_amount ELSE 0 END) AS spent,
          MIN(created_at) AS first_order, MAX(created_at) AS last_order
        FROM orders WHERE store_id = ?";
$args = [STORE_ID];
if ($q !== '') { $sql .= ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ? OR city LIKE ?)'; array_push($args, "%$q%", "%$q%", "%$q%", "%$q%"); }
$stmt = $pdo->prepare($sql . ' GROUP BY customer_phone ORDER BY last_order DESC LIMIT 2000');
$stmt->execute($args);
$rows = $stmt->fetchAll();

if (($_GET['format'] ?? '') === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . STORE_SLUG . '-customers-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Name', 'Phone', 'Email', 'City', 'State', 'Orders', 'Total spent', 'First order', 'Last order']);
    // A leading = + - @ would run as a formula in Excel.
    $safe = function ($v) { $v = (string)$v; return preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v; };
    foreach ($rows as $r) fputcsv($out, array_map($safe, [$r['customer_name'], $r['customer_phone'], $r['customer_email'], $r['city'], $r['state'], $r['orders'], number_format((float)$r['spent'], 2, '.', ''), $r['first_order'], $r['last_order']]));
    exit;
}
$repeat = count(array_filter($rows, function ($r) { return (int)$r['orders'] > 1; }));
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h(STORE_NAME) ?> — Customers</title><?= zkcAdminStyles() ?></head><body><div class="wrap">
<?= zkcAdminHeader('customers', count($rows) . ' customers · ' . $repeat . ' repeat ·') ?>
<form class="card" method="get" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
  <input name="q" value="<?= h($q) ?>" placeholder="Name, phone, email or city"><button>Search</button>
  <a href="?format=csv<?= $q !== '' ? '&q=' . rawurlencode($q) : '' ?>">⬇ Download CSV</a>
</form>
<div class="card scroll"><table><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>City</th><th>Orders</th><th>Total spent</th><th>Last order</th><th></th></tr></thead><tbody>
<?php foreach ($rows as $r): $wa = zkcWaPhone($r['customer_phone']); ?>
  <tr><td><?= h($r['customer_name']) ?></td><td><?= h($r['customer_phone']) ?></td><td><?= h($r['customer_email']) ?></td><td><?= h(trim($r['city'] . ', ' . $r['state'], ', ')) ?></td>
  <td><?= (int)$r['orders'] ?></td><td>₹<?= number_format((float)$r['spent'], 2) ?></td><td><?= h($r['last_order']) ?></td>
  <td><a href="admin-orders.php?q=<?= rawurlencode($r['customer_phone']) ?>">Orders</a><?= $wa ? ' · <a href="https://wa.me/' . $wa . '" target="_blank" rel="noopener">WhatsApp</a>' : '' ?></td></tr>
<?php endforeach; ?>
<?php if (!$rows): ?><tr><td colspan="8">No customers yet.</td></tr><?php endif; ?>
</tbody></table></div>
</div></body></html>
