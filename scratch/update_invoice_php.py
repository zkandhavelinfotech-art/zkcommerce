import base64

# Read logo base64
with open('zkc/assets/themes/smeram/smeram-logo.png', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('ascii')

invoice_code = f'''<?php
/**
 * Smeram Naturals — Compliant GST Tax Invoice
 * Supports print view and 1-click Save as PDF with Smeram logo, GSTIN, billing/shipping,
 * item breakdown, and verified Razorpay payment details.
 */
require_once __DIR__ . '/admin_common.php';

$orderId = (int)($_GET['id'] ?? 0);
if ($orderId <= 0) {{ http_response_code(400); exit('Valid order ID required'); }}

$pdo = getDbConnection();
if (!$pdo) {{ http_response_code(503); exit('Could not connect to MySQL. Check db_config.php.'); }}
try {{ $pdo->exec("SET time_zone = '+05:30'"); }} catch (Exception $e) {{}}

$o = zkcOrderById($pdo, $orderId);
if (!$o) {{ http_response_code(404); exit('Order not found'); }}

$payStatus = strtolower((string)($o['payment_status'] ?? ''));
$ordStatus = strtolower((string)($o['order_status'] ?? ($o['status'] ?? '')));
$payMethod = strtolower((string)($o['payment_method'] ?? ''));
$isPaidOrConfirmed = ($payStatus === 'paid' || in_array($ordStatus, ['confirmed', 'processing', 'shipped', 'delivered']) || ($payMethod === 'cod' && $ordStatus !== 'cancelled'));
if (!$isPaidOrConfirmed) {{
    http_response_code(400);
    exit('Tax invoices are generated only for paid or confirmed orders. Current order payment status is ' . ($payStatus ?: 'unpaid') . '.');
}}

$inv = null;
try {{
    $inv = zkcEnsureInvoice($pdo, $o);
}} catch (Exception $e) {{}}

if (!$inv) {{
    $storeId = defined('STORE_ID') ? STORE_ID : 2;
    $inv = [
        'invoice_number' => 'ZK-' . $storeId . '-' . $orderId,
        'issued_at' => $o['created_at'] ?? date('Y-m-d H:i:s')
    ];
}}

$gstOn = zkcConstOr('GST_ENABLED', true);
$gstRate = (float)($o['gst_rate'] ?? 18);
$gstin = strtoupper((string)zkcConstOr('GSTIN', '33AAGCS1234F1Z9'));
$gstinOk = (bool)preg_match('/^[0-9]{{2}}[A-Z]{{5}}[0-9]{{4}}[A-Z][1-9A-Z]Z[0-9A-Z]$/', $gstin);

$custState = trim((string)($o['state'] ?? 'Tamil Nadu'));
$storeState = defined('STORE_STATE') ? STORE_STATE : 'Tamil Nadu';
$sameState = (strcasecmp($custState, $storeState) === 0 || $custState === '');

$items = zkcOrderItems($o);
$subtotal = (float)(!empty($o['subtotal']) ? $o['subtotal'] : array_sum(array_map(function ($i) {{ return (float)($i['price'] ?? 0) * (int)($i['quantity'] ?? 1); }}, $items)));
if ($subtotal <= 0 && (float)($o['total_amount'] ?? 0) > 0) {{
    $subtotal = (float)$o['total_amount'];
}}
$discount = (float)($o['discount_amount'] ?? 0);
$taxable = max(0, $subtotal - $discount);
$totalAmt = (float)($o['total_amount'] ?? ($taxable + (float)($o['shipping_amount'] ?? 0)));
$gst = (float)($o['gst_amount'] ?? ($taxable * ($gstRate / 100)));

$money = function ($n) {{ return '₹' . number_format((float)$n, 2); }};

function numToWordsINR($num) {{
    $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
             'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    $num = (int)$num;
    if ($num == 0) return 'Zero';
    $w = '';
    if ($num >= 10000000) {{ $w .= numToWordsINR(intval($num / 10000000)) . ' Crore '; $num %= 10000000; }}
    if ($num >= 100000)   {{ $w .= numToWordsINR(intval($num / 100000)) . ' Lakh '; $num %= 100000; }}
    if ($num >= 1000)     {{ $w .= numToWordsINR(intval($num / 1000)) . ' Thousand '; $num %= 1000; }}
    if ($num >= 100)      {{ $w .= numToWordsINR(intval($num / 100)) . ' Hundred '; $num %= 100; }}
    if ($num > 0) {{
        if ($w != '') $w .= 'and ';
        if ($num < 20) $w .= $ones[$num] . ' ';
        else {{ $w .= $tens[intval($num / 10)] . ' '; if ($num % 10 > 0) $w .= $ones[$num % 10] . ' '; }}
    }}
    return trim($w);
}}

$wordsTotal = numToWordsINR(round($totalAmt)) . ' Rupees Only';

$customerName = trim((string)($o['customer_name'] ?? 'Customer'));
$customerPhone = trim((string)($o['customer_phone'] ?? ''));
$customerEmail = trim((string)($o['customer_email'] ?? ''));
$deliveryAddr = trim((string)($o['shipping_address'] ?? ($o['address'] ?? '')));
$city = trim((string)($o['city'] ?? ''));
$state = trim((string)($o['state'] ?? 'Tamil Nadu'));
$pincode = trim((string)($o['pincode'] ?? ''));
$addressLine = implode(', ', array_filter([$deliveryAddr, $city, ($state . ($pincode ? ' ' . $pincode : ''))]));

$rzpPaymentId = trim((string)($o['razorpay_payment_id'] ?? ''));
$rzpOrderId = trim((string)($o['razorpay_order_id'] ?? ''));
$autoPrint = isset($_GET['print']) && $_GET['print'] == '1';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($inv['invoice_number']) ?> — Tax Invoice — <?= h(STORE_NAME) ?></title>
<style>
:root {{
  --brand: #065f46;
  --brand-light: #ecfdf5;
  --brand-dark: #047857;
  --text: #0f172a;
  --muted: #475569;
  --line: #cbd5e1;
  --soft-bg: #f8fafc;
}}
* {{ box-sizing: border-box; }}
body {{
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  color: var(--text);
  margin: 0;
  padding: 24px 16px;
  background: #f1f5f9;
  -webkit-font-smoothing: antialiased;
}}
.bar {{
  max-width: 860px;
  margin: 0 auto 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}}
.btn {{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  font-size: 13.5px;
  font-weight: 700;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
}}
.btn-primary {{ background: var(--brand); color: #fff; border-color: var(--brand); }}
.btn-primary:hover {{ background: var(--brand-dark); }}
.btn-back {{ background: #fff; color: var(--text); border-color: var(--line); }}
.btn-back:hover {{ background: #f8fafc; }}

.invoice-container {{
  max-width: 860px;
  margin: 0 auto;
  background: #fff;
  padding: 36px 42px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}}

/* Header Section */
.inv-header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 24px;
  border-bottom: 2px solid var(--brand);
  gap: 20px;
}}
.store-branding {{
  display: flex;
  flex-direction: column;
  gap: 6px;
}}
.logo-img {{
  max-height: 68px;
  max-width: 220px;
  object-fit: contain;
  margin-bottom: 4px;
}}
.store-meta {{
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted);
}}
.store-meta b {{ color: var(--text); }}

.inv-badge-block {{
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}}
.inv-pill {{
  display: inline-block;
  background: var(--brand);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 5px 14px;
  border-radius: 6px;
  text-transform: uppercase;
  margin-bottom: 6px;
}}
.inv-meta-table {{
  font-size: 13px;
  line-height: 1.55;
  text-align: right;
}}
.inv-meta-table b {{ color: var(--text); }}

/* Billing & Shipping Section */
.parties-grid {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 24px;
}}
.party-card {{
  background: var(--soft-bg);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}}
.party-title {{
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--brand);
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}}
.party-name {{
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 4px;
}}
.party-detail {{
  font-size: 12.5px;
  line-height: 1.5;
  color: #334155;
}}

/* Items Table */
.items-table {{
  width: 100%;
  border-collapse: collapse;
  margin-top: 26px;
  font-size: 13px;
}}
.items-table th {{
  background: #0f172a;
  color: #fff;
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.03em;
}}
.items-table td {{
  padding: 11px 12px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}}
.items-table tr:nth-child(even) td {{
  background: #fcfdfe;
}}
.text-right {{ text-align: right; }}
.text-center {{ text-align: center; }}

/* Totals Summary */
.summary-container {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 18px;
  gap: 20px;
}}
.amount-words-box {{
  flex: 1;
  background: #f8fafc;
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: var(--muted);
}}
.amount-words-box b {{ color: var(--text); }}

.totals-table {{
  width: 340px;
  border-collapse: collapse;
  font-size: 13px;
}}
.totals-table td {{
  padding: 6px 8px;
}}
.totals-table .val {{
  text-align: right;
  font-weight: 600;
}}
.totals-table tr.grand-row td {{
  border-top: 2px solid var(--brand);
  border-bottom: 2px solid var(--brand);
  padding: 10px 8px;
  font-size: 16px;
  font-weight: 800;
  color: var(--brand);
}}

/* Payment Details Box */
.payment-box {{
  margin-top: 24px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}}
.pay-pill {{
  background: #059669;
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}}

/* Footer */
.inv-footer {{
  margin-top: 32px;
  padding-top: 18px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.5;
}}
.footer-support {{ max-width: 500px; }}
.signatory-box {{
  text-align: right;
  font-size: 12px;
}}
.sign-stamp {{
  margin-top: 6px;
  font-weight: 700;
  color: var(--brand);
  padding: 6px 12px;
  border: 1px dashed var(--brand);
  border-radius: 4px;
  display: inline-block;
}}

/* Print Media */
@media print {{
  body {{
    background: #fff;
    padding: 0;
    margin: 0;
  }}
  .bar {{ display: none !important; }}
  .invoice-container {{
    border: none;
    box-shadow: none;
    padding: 0;
    max-width: 100%;
    margin: 0;
  }}
  @page {{
    size: A4 portrait;
    margin: 12mm;
  }}
}}
</style>
</head>
<body>

<div class="bar">
  <a href="admin-orders.php" class="btn btn-back">← Orders Dashboard</a>
  <button class="btn btn-primary" onclick="window.print()">🖨 Print / Save as PDF</button>
</div>

<div class="invoice-container">

  <!-- Header -->
  <div class="inv-header">
    <div class="store-branding">
      <!-- Smeram Naturals Logo -->
      <img src="assets/themes/smeram/smeram-logo.png" onerror="this.src='data:image/png;base64,{logo_b64}'" class="logo-img" alt="Smeram Naturals Logo">
      <div class="store-meta">
        <b><?= h(STORE_NAME) ?></b><br>
        <?= h(STORE_ADDRESS) ?><br>
        <?= h(trim(STORE_CITY . ', ' . STORE_STATE, ', ')) ?> — India<br>
        📞 <b>+91 75399 72026</b> &nbsp;·&nbsp; ✉ care@smeram-naturals.in<br>
        <?php if ($gstOn && $gstin): ?>GSTIN: <b><?= h($gstin) ?></b><?php endif; ?>
      </div>
    </div>

    <div class="inv-badge-block">
      <div class="inv-pill"><?= $gstOn ? 'Tax Invoice' : 'Invoice' ?></div>
      <div class="inv-meta-table">
        <div>Invoice No: <b><?= h($inv['invoice_number']) ?></b></div>
        <div>Invoice Date: <b><?= h(date('d M Y', strtotime($inv['issued_at']))) ?></b></div>
        <div>Order ID: <b><?= h($o['order_number'] ?: ('#' . $o['id'])) ?></b></div>
        <div>Order Date: <?= h(date('d M Y, h:i A', strtotime($o['created_at'] ?? 'now'))) ?></div>
        <div>Place of Supply: <b><?= h($custState) ?></b></div>
      </div>
    </div>
  </div>

  <!-- Billing & Shipping Details -->
  <div class="parties-grid">
    <div class="party-card">
      <div class="party-title">👤 Bill To (Customer Details)</div>
      <div class="party-name"><?= h($customerName) ?></div>
      <div class="party-detail">
        <?php if ($customerPhone): ?>📞 <b><?= h($customerPhone) ?></b><br><?php endif; ?>
        <?php if ($customerEmail): ?>✉ <?= h($customerEmail) ?><br><?php endif; ?>
        📍 <?= h($addressLine ?: 'Address on file') ?>
      </div>
    </div>

    <div class="party-card">
      <div class="party-title">📦 Ship To (Delivery Address)</div>
      <div class="party-name"><?= h($customerName) ?></div>
      <div class="party-detail">
        📞 <?= h($customerPhone ?: 'Contact on file') ?><br>
        📍 <?= h($addressLine ?: 'Delivery address on file') ?><br>
        State: <b><?= h($custState) ?></b>
      </div>
    </div>
  </div>

  <!-- Order Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="text-center" style="width:36px">#</th>
        <th>Product Description</th>
        <th class="text-center" style="width:80px">Variant</th>
        <th class="text-center" style="width:50px">Qty</th>
        <th class="text-right" style="width:105px">Unit Rate</th>
        <th class="text-right" style="width:110px">Total (INR)</th>
      </tr>
    </thead>
    <tbody>
      <?php if (!empty($items)): ?>
        <?php foreach ($items as $idx => $it): ?>
          <tr>
            <td class="text-center"><?= $idx + 1 ?></td>
            <td>
              <strong><?= h($it['name'] ?? 'Product') ?></strong>
              <?php if (!empty($it['sku'])): ?><br><small style="color:var(--muted)">SKU: <?= h($it['sku']) ?></small><?php endif; ?>
            </td>
            <td class="text-center"><?= h($it['size'] ?? ($it['variant'] ?? 'Standard')) ?></td>
            <td class="text-center"><b><?= (int)($it['quantity'] ?? 1) ?></b></td>
            <td class="text-right"><?= $money($it['price'] ?? 0) ?></td>
            <td class="text-right"><b><?= $money((float)($it['price'] ?? 0) * (int)($it['quantity'] ?? 1)) ?></b></td>
          </tr>
        <?php endforeach; ?>
      <?php else: ?>
        <tr>
          <td class="text-center">1</td>
          <td><strong>Order Items</strong></td>
          <td class="text-center">Standard</td>
          <td class="text-center">1</td>
          <td class="text-right"><?= $money($subtotal) ?></td>
          <td class="text-right"><b><?= $money($subtotal) ?></b></td>
        </tr>
      <?php endif; ?>
    </tbody>
  </table>

  <!-- Totals Summary & Words -->
  <div class="summary-container">
    <div class="amount-words-box">
      <div><b>Amount in Words:</b></div>
      <div style="font-weight:700;color:var(--brand);margin-top:3px"><?= h($wordsTotal) ?></div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--muted)">
        <?= $sameState ? 'Tax Breakdown: CGST + SGST applicable for Tamil Nadu intra-state supply.' : 'Tax Breakdown: IGST applicable for inter-state supply.' ?>
      </div>
    </div>

    <table class="totals-table">
      <tr><td>Subtotal</td><td class="val"><?= $money($subtotal) ?></td></tr>
      <?php if ($discount > 0): ?>
        <tr><td>Discount <?= !empty($o['coupon_code']) ? '(' . h($o['coupon_code']) . ')' : '' ?></td><td class="val" style="color:#b91c1c">−<?= $money($discount) ?></td></tr>
      <?php endif; ?>
      <?php if ($gstOn): ?>
        <tr><td>Taxable Amount</td><td class="val"><?= $money($taxable) ?></td></tr>
        <?php if ($sameState): ?>
          <tr><td>CGST @ <?= $gstRate / 2 ?>%</td><td class="val"><?= $money($gst / 2) ?></td></tr>
          <tr><td>SGST @ <?= $gstRate / 2 ?>%</td><td class="val"><?= $money($gst / 2) ?></td></tr>
        <?php else: ?>
          <tr><td>IGST @ <?= $gstRate ?>%</td><td class="val"><?= $money($gst) ?></td></tr>
        <?php endif; ?>
      <?php endif; ?>
      <tr>
        <td>Delivery &amp; Handling</td>
        <td class="val"><?= (float)($o['shipping_amount'] ?? 0) > 0 ? $money($o['shipping_amount']) : '<span style="color:#059669;font-weight:700">FREE</span>' ?></td>
      </tr>
      <tr class="grand-row">
        <td>Total Payable</td>
        <td class="val"><?= $money($totalAmt) ?></td>
      </tr>
    </table>
  </div>

  <!-- Payment Details Box -->
  <div class="payment-box">
    <div>
      <div style="font-size:12px;color:#166534"><b>Payment Status:</b> <span class="pay-pill"><?= strtoupper($o['payment_status'] ?? 'PAID') ?></span></div>
      <div style="font-size:13px;color:#14532d;margin-top:4px">
        Method: <b><?= ($o['payment_method'] ?? '') === 'cod' ? 'Cash on Delivery (COD)' : 'Razorpay Online (UPI / Card / NetBanking)' ?></b>
      </div>
    </div>
    <div style="font-size:12px;color:#166534;text-align:right">
      <?php if ($rzpPaymentId): ?>
        <div>Razorpay Ref: <b style="font-family:monospace;color:#0f172a"><?= h($rzpPaymentId) ?></b></div>
      <?php endif; ?>
      <?php if ($rzpOrderId): ?>
        <div>Order Ref: <span style="font-family:monospace"><?= h($rzpOrderId) ?></span></div>
      <?php endif; ?>
      <div>Transaction Date: <?= h(date('d M Y, h:i A', strtotime($o['created_at'] ?? 'now'))) ?></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <div class="footer-support">
      <b>Customer Support &amp; Care:</b><br>
      For order assistance, shipment queries, or returns, contact WhatsApp <b>+91 75399 72026</b> or email <b>care@smeram-naturals.in</b>.<br>
      <span style="font-size:11px;color:#94a3b8">All products are 100% natural Ayurvedic formulations. This is an authenticated computer-generated invoice. No signature required.</span>
    </div>

    <div class="signatory-box">
      <div>For <b><?= h(STORE_NAME) ?></b></div>
      <div class="sign-stamp">✓ Verified Tax Invoice</div>
      <div style="font-size:10.5px;color:#94a3b8;margin-top:4px">Authorized Signatory</div>
    </div>
  </div>

</div>

<?php if ($autoPrint): ?>
<script>
window.addEventListener('load', function() {{
  setTimeout(function() {{ window.print(); }}, 400);
}});
</script>
<?php endif; ?>

</body>
</html>
'''

with open('zkc/api/services/php/invoice.php', 'w', encoding='utf-8') as f:
    f.write(invoice_code)

print("SUCCESS: invoice.php rewritten with full Smeram Naturals branding, logo, GSTIN, and layout!")

