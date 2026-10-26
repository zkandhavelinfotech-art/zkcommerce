<?php
/** Stock per product / size on the PHP site: set counts after a stock-take, see the history. */
require_once __DIR__ . '/admin_common.php';
$pdo = zkcRequireAdmin('stock');

$error = '';
$message = '';
if (($_POST['action'] ?? '') === 'set_stock') {
    $q = filter_var($_POST['quantity'] ?? null, FILTER_VALIDATE_INT);
    if (!zkcCsrfOk()) $error = 'Your session expired. Please try again.';
    elseif ($q === false || $q < 0) $error = 'Stock must be a whole number from 0.';
    else {
        try {
            $r = zkcSetStock($pdo, (int)$_POST['product_id'], (string)($_POST['variant_id'] ?? ''), $q, (string)($_POST['note'] ?? ''));
            $message = 'Stock updated: ' . $r['before'] . ' → ' . $r['quantity'];
        } catch (Exception $e) { $error = $e->getMessage(); }
    }
}
$rows = zkcStockOverview($pdo);
$low = count(array_filter($rows, function ($r) { return $r['quantity'] <= $r['threshold']; }));
$hist = $pdo->prepare('SELECT m.*, p.name FROM inventory_movements m LEFT JOIN products p ON p.id = m.product_id WHERE m.store_id = ? ORDER BY m.id DESC LIMIT 50');
$hist->execute([STORE_ID]);
$csrf = zkcCsrf();
$reasons = ['order' => 'Order', 'cancel' => 'Cancelled / returned', 'adjust' => 'Adjusted', 'initial' => 'Opening stock'];
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h(STORE_NAME) ?> — Stock</title><?= zkcAdminStyles() ?></head><body><div class="wrap">
<?= zkcAdminHeader('stock', count($rows) . ' items · ' . $low . ' low ·') ?>
<?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
<?php if ($message): ?><p class="ok"><?= h($message) ?></p><?php endif; ?>
<div class="card scroll"><h2>Stock</h2>
<p class="muted">Orders take stock automatically (COD when placed, online payments once paid); cancelling or returning puts it back. A WhatsApp alert goes to customer care when an item falls to its low-stock level. New package uploads add new products and sizes but never change these counts.</p>
<table><thead><tr><th>Product</th><th>Size</th><th>SKU</th><th>In stock</th><th>Alert level</th><th>Set stock</th></tr></thead><tbody>
<?php foreach ($rows as $r): ?>
  <tr><td><?= h($r['name']) ?></td><td><?= h($r['size']) ?></td><td><?= h($r['sku']) ?></td>
  <td><b><?= (int)$r['quantity'] ?></b> <?= $r['quantity'] <= $r['threshold'] ? '<span class="pill low">LOW</span>' : '' ?></td><td><?= (int)$r['threshold'] ?></td>
  <td><form method="post" style="display:flex;gap:6px"><input type="hidden" name="action" value="set_stock"><input type="hidden" name="csrf" value="<?= h($csrf) ?>">
    <input type="hidden" name="product_id" value="<?= (int)$r['product_id'] ?>"><input type="hidden" name="variant_id" value="<?= h($r['variant_id']) ?>">
    <input type="number" name="quantity" min="0" value="<?= (int)$r['quantity'] ?>" style="width:90px"><input name="note" placeholder="Note" size="12"><button class="light">Save</button></form></td></tr>
<?php endforeach; ?>
<?php if (!$rows): ?><tr><td colspan="6">No products.</td></tr><?php endif; ?>
</tbody></table></div>
<div class="card scroll"><h2>Recent stock changes</h2><table><thead><tr><th>When</th><th>Product</th><th>Change</th><th>After</th><th>Reason</th></tr></thead><tbody>
<?php foreach ($hist->fetchAll() as $m): ?>
  <tr><td><?= h($m['created_at']) ?></td><td><?= h($m['name']) ?><?= $m['variant_id'] !== '' ? ' <span class="muted">' . h($m['variant_id']) . '</span>' : '' ?></td>
  <td><?= (int)$m['delta'] > 0 ? '+' : '' ?><?= (int)$m['delta'] ?></td><td><?= (int)$m['quantity_after'] ?></td><td><?= h($reasons[$m['reason']] ?? $m['reason']) ?><?= $m['order_id'] ? ' #' . (int)$m['order_id'] : '' ?> <span class="muted"><?= h($m['note']) ?></span></td></tr>
<?php endforeach; ?>
</tbody></table></div>
</div></body></html>
