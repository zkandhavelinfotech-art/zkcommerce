<?php
/**
 * Coupons and shipping rates on the PHP site. They are created in the ZKCommerce dashboard and arrive with each package;
 * here the merchant sees usage and can pause or resume them without a redeploy.
 */
require_once __DIR__ . '/admin_common.php';
$pdo = zkcRequireAdmin('coupons');

$error = '';
if (in_array($_POST['action'] ?? '', ['coupon_active', 'rate_active'], true)) {
    if (!zkcCsrfOk()) $error = 'Your session expired. Please try again.';
    else {
        $table = $_POST['action'] === 'coupon_active' ? 'coupons' : 'shipping_rates';
        $pdo->prepare("UPDATE $table SET active = ? WHERE id = ? AND store_id = ?")->execute([($_POST['active'] ?? '') === '1' ? 1 : 0, (int)$_POST['id'], STORE_ID]);
        header('Location: coupons.php'); exit;
    }
}
$coupons = $pdo->prepare('SELECT * FROM coupons WHERE store_id = ? ORDER BY active DESC, code');
$coupons->execute([STORE_ID]);
$rates = $pdo->prepare('SELECT * FROM shipping_rates WHERE store_id = ? ORDER BY active DESC, rate');
$rates->execute([STORE_ID]);
$csrf = zkcCsrf();
function zkcToggle($action, $id, $active, $csrf) {
    return '<form method="post" style="display:inline"><input type="hidden" name="action" value="' . $action . '"><input type="hidden" name="csrf" value="' . h($csrf) . '"><input type="hidden" name="id" value="' . (int)$id . '"><input type="hidden" name="active" value="' . ($active ? '0' : '1') . '"><button class="light">' . ($active ? 'Pause' : 'Resume') . '</button></form>';
}
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h(STORE_NAME) ?> — Coupons &amp; shipping</title><?= zkcAdminStyles() ?></head><body><div class="wrap">
<?= zkcAdminHeader('coupons') ?>
<?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
<div class="card scroll"><h2>Coupons</h2>
<p class="muted">Add or edit coupons in the ZKCommerce dashboard (Coupons), then upload the next package. <?= CHECKOUT_COUPON ? '' : '<b>The discount-code box is switched off for this store</b> (Store Builder → Settings → checkout).' ?></p>
<table><thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Used</th><th>Valid</th><th>Status</th><th></th></tr></thead><tbody>
<?php foreach ($coupons->fetchAll() as $c): ?>
  <tr><td><b><?= h($c['code']) ?></b></td><td><?= $c['discount_type'] === 'percent' ? (float)$c['discount_value'] . '%' : '₹' . number_format((float)$c['discount_value'], 0) ?></td>
  <td>₹<?= (int)$c['minimum_order'] ?></td><td><?= (int)$c['used_count'] ?><?= $c['usage_limit'] ? ' / ' . (int)$c['usage_limit'] : '' ?></td>
  <td class="muted"><?= h($c['starts_at'] ?: '—') ?> → <?= h($c['expires_at'] ?: 'no end') ?></td><td><?= $c['active'] ? '<span class="pill">Active</span>' : '<span class="pill low">Paused</span>' ?></td>
  <td><?= zkcToggle('coupon_active', $c['id'], (int)$c['active'] === 1, $csrf) ?></td></tr>
<?php endforeach; ?>
</tbody></table></div>
<div class="card scroll"><h2>Shipping rates</h2>
<p class="muted">Shown to shoppers at checkout by PIN code. Edit them in the ZKCommerce dashboard (Shipping).</p>
<table><thead><tr><th>Name</th><th>Fee</th><th>Free above</th><th>PIN prefix</th><th>Delivery</th><th>Status</th><th></th></tr></thead><tbody>
<?php foreach ($rates->fetchAll() as $r): ?>
  <tr><td><?= h($r['name']) ?></td><td>₹<?= (int)$r['rate'] ?></td><td><?= $r['free_above'] !== null ? '₹' . (int)$r['free_above'] : '—' ?></td><td><?= h($r['postal_prefix'] ?: 'All') ?></td><td><?= h($r['estimated_days']) ?></td>
  <td><?= $r['active'] ? '<span class="pill">Active</span>' : '<span class="pill low">Paused</span>' ?></td><td><?= zkcToggle('rate_active', $r['id'], (int)$r['active'] === 1, $csrf) ?></td></tr>
<?php endforeach; ?>
</tbody></table></div>
</div></body></html>
