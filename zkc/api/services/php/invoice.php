<?php
/**
 * Printable invoice for one order (invoice.php?id=ORDER_ID). With GST on it is a Tax Invoice:
 * CGST + SGST when the customer is in the store's state, IGST otherwise. Numbering matches the Node dashboard.
 */
require_once __DIR__ . '/admin_common.php';
$pdo = zkcRequireAdmin('invoice?id=' . (int)($_GET['id'] ?? 0));

$o = zkcOrderById($pdo, (int)($_GET['id'] ?? 0));
if (!$o) { http_response_code(404); exit('Order not found'); }
try { $inv = zkcEnsureInvoice($pdo, $o); }
catch (Exception $e) { http_response_code(409); exit(h($e->getMessage())); }

$gstOn = zkcConstOr('GST_ENABLED', false) && (float)$o['gst_rate'] > 0;
$gstin = strtoupper((string)zkcConstOr('GSTIN', ''));
$gstinOk = (bool)preg_match('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/', $gstin);
$sameState = strcasecmp(trim((string)$o['state']), trim((string)STORE_STATE)) === 0 || trim((string)$o['state']) === '';
$items = zkcOrderItems($o);
$subtotal = (float)($o['subtotal'] ?: array_sum(array_map(function ($i) { return (float)$i['price'] * (int)$i['quantity']; }, $items)));
$discount = (float)$o['discount_amount'];
$taxable = max(0, $subtotal - $discount);
$gst = (float)$o['gst_amount'];
$money = function ($n) { return '₹' . number_format((float)$n, 2); };
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($inv['invoice_number']) ?> — <?= h(STORE_NAME) ?></title>
<style>
body{font-family:system-ui,Arial,sans-serif;color:#111;margin:0;padding:24px;background:#f1f5f9}.page{max-width:820px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e2e8f0}
h1{font-size:22px;margin:0}.row{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}.muted{color:#555;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left}th{background:#f8fafc}td.n,th.n{text-align:right}
.tot td{border:none;padding:4px 9px}.tot tr.grand td{font-weight:800;font-size:15px;border-top:2px solid #111}.warn{background:#fef2f2;color:#b91c1c;padding:8px 12px;border-radius:6px;font-size:13px}
.bar{max-width:820px;margin:0 auto 12px;display:flex;gap:8px}@media print{body{background:#fff;padding:0}.bar{display:none}.page{border:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">🖨 Print / Save as PDF</button> <a href="admin-orders.php">← Orders</a></div>
<div class="page">
  <?php if ($gstOn && !$gstinOk): ?><p class="warn">GST is on but the store GSTIN is missing or invalid. Set it in the ZKCommerce dashboard and upload the next package.</p><?php endif; ?>
  <div class="row">
    <div><h1><?= $gstOn ? 'Tax Invoice' : 'Invoice' ?></h1>
      <div class="muted">Invoice no. <b><?= h($inv['invoice_number']) ?></b><br>Date <?= h(date('d M Y', strtotime($inv['issued_at']))) ?><br>Order <?= h($o['order_number']) ?> · <?= h(date('d M Y', strtotime($o['created_at']))) ?></div></div>
    <div style="text-align:right"><b><?= h(STORE_NAME) ?></b><div class="muted"><?= h(STORE_ADDRESS) ?><br><?= h(trim(STORE_CITY . ', ' . STORE_STATE, ', ')) ?><?= $gstOn ? '<br>GSTIN: <b>' . h($gstin) . '</b>' : '' ?><?= STORE_PHONE ? '<br>' . h(STORE_PHONE) : '' ?></div></div>
  </div>
  <div style="margin-top:18px"><b>Bill / ship to</b><div class="muted"><?= h($o['customer_name']) ?> · <?= h($o['customer_phone']) ?><?= $o['customer_email'] ? ' · ' . h($o['customer_email']) : '' ?><br><?= h($o['shipping_address']) ?>, <?= h(trim($o['city'] . ', ' . $o['state'] . ' ' . $o['pincode'], ', ')) ?><?= $gstOn ? '<br>Place of supply: ' . h($o['state'] ?: STORE_STATE) : '' ?></div></div>
  <table><thead><tr><th>#</th><th>Item</th><th>SKU</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>
  <?php foreach ($items as $n => $i): ?><tr><td><?= $n + 1 ?></td><td><?= h($i['name'] ?? '') ?><?= !empty($i['size']) ? ' (' . h($i['size']) . ')' : '' ?></td><td><?= h($i['sku'] ?? '') ?></td><td class="n"><?= (int)$i['quantity'] ?></td><td class="n"><?= $money($i['price']) ?></td><td class="n"><?= $money((float)$i['price'] * (int)$i['quantity']) ?></td></tr><?php endforeach; ?>
  </tbody></table>
  <table class="tot" style="width:360px;margin-left:auto">
    <tr><td>Subtotal</td><td class="n"><?= $money($subtotal) ?></td></tr>
    <?php if ($discount > 0): ?><tr><td>Discount<?= $o['coupon_code'] ? ' (' . h($o['coupon_code']) . ')' : '' ?></td><td class="n">−<?= $money($discount) ?></td></tr><?php endif; ?>
    <?php if ($gstOn): ?>
      <tr><td>Taxable value</td><td class="n"><?= $money($taxable) ?></td></tr>
      <?php if ($sameState): ?>
        <tr><td>CGST @ <?= (float)$o['gst_rate'] / 2 ?>%</td><td class="n"><?= $money($gst / 2) ?></td></tr>
        <tr><td>SGST @ <?= (float)$o['gst_rate'] / 2 ?>%</td><td class="n"><?= $money($gst / 2) ?></td></tr>
      <?php else: ?><tr><td>IGST @ <?= (float)$o['gst_rate'] ?>%</td><td class="n"><?= $money($gst) ?></td></tr><?php endif; ?>
    <?php endif; ?>
    <?php if ((float)$o['shipping_amount'] > 0): ?><tr><td>Shipping</td><td class="n"><?= $money($o['shipping_amount']) ?></td></tr><?php endif; ?>
    <tr class="grand"><td>Total</td><td class="n"><?= $money($o['total_amount']) ?></td></tr>
  </table>
  <p class="muted" style="margin-top:24px">Payment: <?= $o['payment_method'] === 'cod' ? 'Cash on delivery' : 'Paid online (Razorpay' . ($o['razorpay_payment_id'] ? ' · ' . h($o['razorpay_payment_id']) : '') . ')' ?>. This is a computer-generated invoice.</p>
</div></body></html>
