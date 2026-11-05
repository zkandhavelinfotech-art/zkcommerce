<?php
/**
 * Smeram Industries — Compliant B2C GST Tax Invoice
 * Billing Entity: Smeram Industries
 * Trade Name: Smeram Naturals
 * GSTIN: 33DVRPR1801M1Z6 | State: Tamil Nadu (Code 33)
 * Invoice Number format: SM-01, SM-02, SM-03...
 * Prices are INCLUSIVE of GST with exact product-wise HSN and GST calculation breakup.
 */
if (session_status() !== PHP_SESSION_ACTIVE) @session_start();
require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';
if (is_file(__DIR__ . '/whatsapp_config.php')) require_once __DIR__ . '/whatsapp_config.php';
require_once __DIR__ . '/whatsapp_orders.php';
require_once __DIR__ . '/commerce.php';

function h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

$pdo = getDbConnection();
try { if ($pdo) $pdo->exec("SET time_zone = '+05:30'"); } catch (Exception $e) {}

$orderId = (int)($_GET['id'] ?? 0);
$tbl = function_exists('zkcGetOrdersTable') ? zkcGetOrdersTable($pdo) : 'orders';

// If no orderId given, pick the latest order so the merchant never sees an empty screen
if ($orderId <= 0 && $pdo) {
    try {
        $latest = $pdo->query("SELECT id FROM `{$tbl}` ORDER BY id DESC LIMIT 1")->fetchColumn();
        if ($latest) $orderId = (int)$latest;
    } catch (Exception $e) {}
}

$o = ($pdo && $orderId > 0 && function_exists('zkcOrderById')) ? zkcOrderById($pdo, $orderId) : null;
if (!$o && $pdo && $orderId > 0) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE id = ?");
        $stmt->execute([$orderId]);
        $o = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}
}

// Fallback demo order if database is empty or test
if (!$o) {
    $orderId = 1;
    $o = [
        'id' => 1,
        'order_number' => 'ORD-20261105-001',
        'customer_name' => 'K. R. Soundararajan',
        'customer_phone' => '+91 98401 23456',
        'customer_email' => 'soundar@example.com',
        'shipping_address' => 'Plot 45, Gandhi Nagar, 2nd Cross Street',
        'city' => 'Madurai',
        'state' => 'Tamil Nadu',
        'pincode' => '625020',
        'items_json' => json_encode([
            ['name' => 'Mahanarayan Ortho Pain Oil', 'size' => '100ml', 'quantity' => 1, 'price' => 349.00],
            ['name' => 'Smeram Naturals Hair Oil', 'size' => '100ml', 'quantity' => 1, 'price' => 299.00]
        ]),
        'total_amount' => 648.00,
        'subtotal' => 648.00,
        'payment_method' => 'razorpay',
        'payment_status' => 'paid',
        'order_status' => 'confirmed',
        'razorpay_payment_id' => 'pay_SMERAM9840123',
        'created_at' => date('Y-m-d H:i:s')
    ];
}

$payStatus = strtolower((string)($o['payment_status'] ?? 'paid'));
$ordStatus = strtolower((string)($o['order_status'] ?? ($o['status'] ?? 'confirmed')));
$payMethod = strtolower((string)($o['payment_method'] ?? 'razorpay'));

// Format invoice number as SM-01, SM-02, SM-03...
$invNum = 'SM-' . sprintf('%02d', $orderId);

$billingName = 'Smeram Industries';
$brandName   = 'Smeram Naturals';
$gstin       = '33DVRPR1801M1Z6';
$storeState  = 'Tamil Nadu';
$storeCode   = '33';
$storeAddr   = defined('STORE_ADDRESS') ? STORE_ADDRESS : '22/13 Rajaveedhi Street, Choolaimedu';
$storeCity   = defined('STORE_CITY') ? STORE_CITY : 'Chennai';
$storePhone  = defined('STORE_PHONE') ? STORE_PHONE : '+91 75399 72026';

$custState = trim((string)($o['state'] ?? 'Tamil Nadu'));
$sameState = (strcasecmp($custState, $storeState) === 0 || $custState === '' || stripos($custState, 'tamil') !== false);
$custCode  = $sameState ? '33' : 'Other';

function zkcProductGstInfo($name, $presetRate = null, $presetHsn = null) {
    if (!empty($presetRate) && !empty($presetHsn)) {
        return ['rate' => (float)$presetRate, 'hsn' => (string)$presetHsn, 'desc' => (string)$name];
    }
    $n = strtolower((string)$name);
    // 1) Pain oil - GST 5%, HSN code 30049013
    if (strpos($n, 'pain') !== false || strpos($n, 'ortho') !== false || strpos($n, 'joint') !== false) {
        return ['rate' => 5.0, 'hsn' => '30049013', 'desc' => 'Mahanarayan Ortho Pain Oil (Herbal)'];
    }
    // 2) Hair oil - 5%, HSN code 33059019
    if (strpos($n, 'hair') !== false || strpos($n, 'thailam') !== false) {
        return ['rate' => 5.0, 'hsn' => '33059019', 'desc' => 'Smeram Classical Siddha Hair Oil'];
    }
    // 3) Face pack - 18%, HSN code 33049990
    if (strpos($n, 'face') !== false || strpos($n, 'kumkumadi') !== false || strpos($n, 'ayurgold') !== false) {
        return ['rate' => 18.0, 'hsn' => '33049990', 'desc' => 'Ayurgold Kumkumadi Face Oil / Pack'];
    }
    // 4) Health mix - 18%, HSN code 19011099
    if (strpos($n, 'health') !== false || strpos($n, 'mix') !== false || strpos($n, 'ghee') !== false || strpos($n, 'bilona') !== false || strpos($n, 'vedic') !== false) {
        return ['rate' => 18.0, 'hsn' => '19011099', 'desc' => 'Vedic Health Foods / Mix / Desi Ghee'];
    }
    return ['rate' => 5.0, 'hsn' => '30049013', 'desc' => 'Ayurvedic Herbal Product'];
}

$rawItems = function_exists('zkcOrderItems') ? zkcOrderItems($o) : [];
if (empty($rawItems)) {
    $rawItems = [['name' => 'Smeram Naturals Ayurvedic Products', 'quantity' => 1, 'price' => (float)($o['total_amount'] ?? 349.00)]];
}

// Calculate inclusive GST breakup per product
$itemsBreakup = [];
$totTaxable = 0.0;
$totCgst = 0.0;
$totSgst = 0.0;
$totIgst = 0.0;
$totGross = 0.0;
$taxSummary = [];

foreach ($rawItems as $it) {
    $name = (string)($it['name'] ?? 'Product');
    $size = (string)($it['size'] ?? ($it['variant'] ?? ''));
    $qty = max(1, (int)($it['quantity'] ?? ($it['qty'] ?? 1)));
    $unitGross = (float)($it['price'] ?? ($it['unit_price'] ?? 0));
    $lineGross = $unitGross * $qty;
    $gstInfo = zkcProductGstInfo($name, $it['gst_rate'] ?? null, $it['hsn_code'] ?? null);
    $rate = $gstInfo['rate'];
    $hsn = $gstInfo['hsn'];

    // Inclusive GST math: Taxable = Gross * 100 / (100 + Rate)
    $lineTaxable = round($lineGross * 100.0 / (100.0 + $rate), 2);
    $lineGst = round($lineGross - $lineTaxable, 2);
    $unitTaxable = round($lineTaxable / $qty, 2);

    if ($sameState) {
        $cgstRate = $rate / 2.0;
        $sgstRate = $rate / 2.0;
        $cgstAmt = round($lineGst / 2.0, 2);
        $sgstAmt = round($lineGst - $cgstAmt, 2);
        $igstRate = 0.0;
        $igstAmt = 0.0;
        $totCgst += $cgstAmt;
        $totSgst += $sgstAmt;
    } else {
        $cgstRate = 0.0;
        $sgstRate = 0.0;
        $cgstAmt = 0.0;
        $sgstAmt = 0.0;
        $igstRate = $rate;
        $igstAmt = $lineGst;
        $totIgst += $igstAmt;
    }

    $totTaxable += $lineTaxable;
    $totGross += $lineGross;

    // Aggregate summary by HSN & rate
    $key = $hsn . '_' . $rate;
    if (!isset($taxSummary[$key])) {
        $taxSummary[$key] = [
            'hsn' => $hsn,
            'rate' => $rate,
            'taxable' => 0.0,
            'cgst' => 0.0,
            'sgst' => 0.0,
            'igst' => 0.0,
            'total_tax' => 0.0
        ];
    }
    $taxSummary[$key]['taxable'] += $lineTaxable;
    $taxSummary[$key]['cgst'] += $cgstAmt;
    $taxSummary[$key]['sgst'] += $sgstAmt;
    $taxSummary[$key]['igst'] += $igstAmt;
    $taxSummary[$key]['total_tax'] += $lineGst;

    $itemsBreakup[] = [
        'name' => $name,
        'size' => $size,
        'hsn' => $hsn,
        'qty' => $qty,
        'unit_gross' => $unitGross,
        'unit_taxable' => $unitTaxable,
        'line_taxable' => $lineTaxable,
        'rate' => $rate,
        'cgst_rate' => $cgstRate,
        'cgst_amt' => $cgstAmt,
        'sgst_rate' => $sgstRate,
        'sgst_amt' => $sgstAmt,
        'igst_rate' => $igstRate,
        'igst_amt' => $igstAmt,
        'line_gross' => $lineGross
    ];
}

$discount = (float)($o['discount_amount'] ?? 0);
$shipping = (float)($o['shipping_amount'] ?? 0);
$grandTotal = (float)($o['total_amount'] ?? max(0, $totGross - $discount + $shipping));

$money = function ($n) { return '₹' . number_format((float)$n, 2); };

function numToWordsINR($num) {
    $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
             'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    $num = (int)$num;
    if ($num == 0) return 'Zero';
    $w = '';
    if ($num >= 10000000) { $w .= numToWordsINR(intval($num / 10000000)) . ' Crore '; $num %= 10000000; }
    if ($num >= 100000)   { $w .= numToWordsINR(intval($num / 100000)) . ' Lakh '; $num %= 100000; }
    if ($num >= 1000)     { $w .= numToWordsINR(intval($num / 1000)) . ' Thousand '; $num %= 1000; }
    if ($num >= 100)      { $w .= numToWordsINR(intval($num / 100)) . ' Hundred '; $num %= 100; }
    if ($num > 0) {
        if ($w != '') $w .= 'and ';
        if ($num < 20) $w .= $ones[$num] . ' ';
        else { $w .= $tens[intval($num / 10)] . ' '; if ($num % 10 > 0) $w .= $ones[$num % 10] . ' '; }
    }
    return trim($w);
}

$wordsTotal = numToWordsINR(round($grandTotal)) . ' Rupees Only';

$customerName = trim((string)($o['customer_name'] ?? 'Guest Customer'));
$customerPhone = trim((string)($o['customer_phone'] ?? ''));
$customerEmail = trim((string)($o['customer_email'] ?? ''));
$deliveryAddr = trim((string)($o['shipping_address'] ?? ($o['address'] ?? '')));
$city = trim((string)($o['city'] ?? ''));
$state = trim((string)($o['state'] ?? 'Tamil Nadu'));
$pincode = trim((string)($o['pincode'] ?? ''));
$addressLine = implode(', ', array_filter([$deliveryAddr, $city, ($state . ($pincode ? ' — ' . $pincode : ''))]));

$rzpPaymentId = trim((string)($o['razorpay_payment_id'] ?? ''));
$rzpOrderId = trim((string)($o['razorpay_order_id'] ?? ''));
$autoPrint = isset($_GET['print']) && $_GET['print'] == '1';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($invNum) ?> — GST Tax Invoice — <?= h($billingName) ?></title>
<style>
:root {
  --brand: #065f46;
  --brand-dark: #047857;
  --brand-light: #ecfdf5;
  --ink: #0f172a;
  --muted: #475569;
  --line: #cbd5e1;
  --soft: #f8fafc;
}
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink);
  margin: 0;
  padding: 24px 16px 60px;
  background: #f1f5f9;
  -webkit-font-smoothing: antialiased;
}
.bar {
  max-width: 900px;
  margin: 0 auto 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.btn {
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
}
.btn-primary { background: var(--brand); color: #fff; border-color: var(--brand); box-shadow: 0 2px 6px rgba(6,95,70,0.25); }
.btn-primary:hover { background: var(--brand-dark); }
.btn-back { background: #fff; color: var(--ink); border-color: var(--line); }
.btn-back:hover { background: #f8fafc; }

.invoice-sheet {
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  padding: 38px 44px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
}

/* Header Section */
.inv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 2.5px solid var(--brand);
}
.brand-col {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.logo-img {
  max-height: 66px;
  max-width: 220px;
  object-fit: contain;
  margin-bottom: 4px;
}
.billing-company-title {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.01em;
  color: #064e3b;
  margin: 0;
}
.trade-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-dark);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.company-details {
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
  margin-top: 4px;
}
.company-details b { color: var(--ink); }

.invoice-badge-col {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.tax-invoice-pill {
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
}
.inv-number-big {
  font-size: 18px;
  font-weight: 800;
  color: #064e3b;
  font-family: monospace;
}
.meta-table {
  font-size: 12.5px;
  line-height: 1.6;
  text-align: right;
}
.meta-table b { color: var(--ink); }

/* Parties: Bill To & Ship To */
.parties-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 22px;
}
.party-box {
  background: var(--soft);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 13px 15px;
}
.party-heading {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--brand);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.party-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--ink);
  margin-bottom: 3px;
}
.party-text {
  font-size: 12.5px;
  line-height: 1.5;
  color: #334155;
}

/* Table of Goods with GST Breakdown */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 22px;
  font-size: 12.5px;
}
.items-table th {
  background: #0f172a;
  color: #fff;
  padding: 9px 8px;
  text-align: left;
  font-weight: 700;
  font-size: 11.5px;
  letter-spacing: 0.02em;
}
.items-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}
.items-table tr:nth-child(even) td {
  background: #fafbfe;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.tag-inclusive {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #065f46;
  background: #d1fae5;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 4px;
}

/* Tax Summary Table */
.gst-summary-block {
  margin-top: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
}
.gst-summary-title {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.gst-summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.gst-summary-table th {
  border-bottom: 1px solid #cbd5e1;
  padding: 5px 6px;
  text-align: left;
  color: #475569;
  font-size: 11px;
}
.gst-summary-table td {
  padding: 6px 6px;
  border-bottom: 1px dashed #e2e8f0;
}

/* Totals Box */
.totals-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 18px;
  gap: 20px;
}
.words-box {
  flex: 1;
  background: var(--soft);
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12.5px;
}
.words-box b { color: var(--brand); }

.totals-table {
  width: 330px;
  border-collapse: collapse;
  font-size: 13px;
}
.totals-table td {
  padding: 6px 8px;
}
.totals-table .val {
  text-align: right;
  font-weight: 600;
}
.totals-table tr.grand td {
  border-top: 2px solid var(--brand);
  border-bottom: 2px solid var(--brand);
  padding: 9px 8px;
  font-size: 16px;
  font-weight: 900;
  color: var(--brand);
}

/* Payment Verified Card */
.payment-card {
  margin-top: 22px;
  background: #f0fdf4;
  border: 1.5px solid #86efac;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.pay-status-pill {
  display: inline-block;
  background: #059669;
  color: #fff;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Footer */
.inv-footer {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.55;
}
.stamp-box {
  text-align: right;
  font-size: 12px;
}
.stamp-seal {
  margin-top: 6px;
  color: var(--brand);
  border: 1.5px dashed var(--brand);
  padding: 5px 12px;
  border-radius: 6px;
  font-weight: 800;
  display: inline-block;
}

/* Print Stylesheet */
@media print {
  body { background: #fff; padding: 0; margin: 0; }
  .bar { display: none !important; }
  .invoice-sheet {
    border: none;
    box-shadow: none;
    padding: 0;
    max-width: 100%;
    margin: 0;
  }
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
}
</style>
</head>
<body>

<div class="bar">
  <a href="admin-orders.php" class="btn btn-back">← Orders Dashboard</a>
  <button type="button" class="btn btn-primary" onclick="window.print()">🖨 Print / Save as PDF</button>
</div>

<div class="invoice-sheet">

  <!-- Header -->
  <div class="inv-header">
    <div class="brand-col">
      <img src="assets/themes/smeram/smeram-logo.png" onerror="this.src='data:image/png;base64,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'" class="logo-img" alt="Smeram Logo">
      <h1 class="billing-company-title"><?= h($billingName) ?></h1>
      <div class="trade-name">Trade Brand: <?= h($brandName) ?></div>
      <div class="company-details">
        <?= h($storeAddr) ?><br>
        <?= h($storeCity) ?>, <?= h($storeState) ?> — State Code: <b><?= h($storeCode) ?></b><br>
        GSTIN: <b style="font-size:13px;color:#064e3b"><?= h($gstin) ?></b><br>
        📞 <b><?= h($storePhone) ?></b> &nbsp;·&nbsp; ✉ care@smeram-naturals.in
      </div>
    </div>

    <div class="invoice-badge-col">
      <div class="tax-invoice-pill">TAX INVOICE</div>
      <div class="inv-number-big"><?= h($invNum) ?></div>
      <div class="meta-table">
        <div>Invoice Date: <b><?= h(date('d M Y', strtotime($o['created_at'] ?? 'now'))) ?></b></div>
        <div>Order Number: <b><?= h($o['order_number'] ?: ('#' . $orderId)) ?></b></div>
        <div>Order Date: <?= h(date('d M Y, h:i A', strtotime($o['created_at'] ?? 'now'))) ?></div>
        <div>Place of Supply: <b><?= h($custState) ?> (<?= h($custCode) ?>)</b></div>
      </div>
    </div>
  </div>

  <!-- Parties: Bill To & Ship To -->
  <div class="parties-row">
    <div class="party-box">
      <div class="party-heading">👤 BILL TO (BUYER DETAILS)</div>
      <div class="party-name"><?= h($customerName) ?></div>
      <div class="party-text">
        <?php if ($customerPhone): ?>📞 <b><?= h($customerPhone) ?></b><br><?php endif; ?>
        <?php if ($customerEmail): ?>✉ <?= h($customerEmail) ?><br><?php endif; ?>
        📍 <?= h($addressLine ?: 'Address on file') ?><br>
        State: <b><?= h($custState) ?></b>
      </div>
    </div>

    <div class="party-box">
      <div class="party-heading">📦 SHIP TO (DELIVERY ADDRESS)</div>
      <div class="party-name"><?= h($customerName) ?></div>
      <div class="party-text">
        📞 <?= h($customerPhone ?: 'Contact on file') ?><br>
        📍 <?= h($addressLine ?: 'Delivery address on file') ?><br>
        State: <b><?= h($custState) ?></b>
      </div>
    </div>
  </div>

  <!-- Product Table with Inclusive GST Breakdown -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="text-center" style="width:30px">#</th>
        <th>Product Description</th>
        <th class="text-center" style="width:75px">HSN Code</th>
        <th class="text-center" style="width:40px">Qty</th>
        <th class="text-right" style="width:85px">Gross Rate<span class="tag-inclusive">Incl</span></th>
        <th class="text-right" style="width:85px">Taxable Val</th>
        <th class="text-center" style="width:65px">GST%</th>
        <?php if ($sameState): ?>
          <th class="text-right" style="width:70px">CGST</th>
          <th class="text-right" style="width:70px">SGST</th>
        <?php else: ?>
          <th class="text-right" style="width:90px">IGST</th>
        <?php endif; ?>
        <th class="text-right" style="width:90px">Total (INR)</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($itemsBreakup as $idx => $it): ?>
        <tr>
          <td class="text-center"><?= $idx + 1 ?></td>
          <td>
            <strong><?= h($it['name']) ?></strong>
            <?php if (!empty($it['size'])): ?><span style="color:var(--muted)"> (<?= h($it['size']) ?>)</span><?php endif; ?>
          </td>
          <td class="text-center" style="font-family:monospace;font-weight:700"><?= h($it['hsn']) ?></td>
          <td class="text-center"><b><?= $it['qty'] ?></b></td>
          <td class="text-right"><?= $money($it['unit_gross']) ?></td>
          <td class="text-right"><?= $money($it['line_taxable']) ?></td>
          <td class="text-center"><b><?= $it['rate'] ?>%</b></td>
          <?php if ($sameState): ?>
            <td class="text-right"><?= $money($it['cgst_amt']) ?></td>
            <td class="text-right"><?= $money($it['sgst_amt']) ?></td>
          <?php else: ?>
            <td class="text-right"><?= $money($it['igst_amt']) ?></td>
          <?php endif; ?>
          <td class="text-right"><b><?= $money($it['line_gross']) ?></b></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>

  <!-- GST Calculation Summary (Inclusive Formula Breakup) -->
  <div class="gst-summary-block">
    <div class="gst-summary-title">📊 GST Tax Breakdown (Inclusive Calculation: Taxable = Gross × 100 / (100 + GST%))</div>
    <table class="gst-summary-table">
      <thead>
        <tr>
          <th>HSN / SAC</th>
          <th class="text-right">Taxable Amount</th>
          <?php if ($sameState): ?>
            <th class="text-right">CGST Rate</th>
            <th class="text-right">CGST Amount</th>
            <th class="text-right">SGST Rate</th>
            <th class="text-right">SGST Amount</th>
          <?php else: ?>
            <th class="text-right">IGST Rate</th>
            <th class="text-right">IGST Amount</th>
          <?php endif; ?>
          <th class="text-right">Total Tax Amount</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($taxSummary as $row): ?>
          <tr>
            <td style="font-family:monospace;font-weight:700"><?= h($row['hsn']) ?></td>
            <td class="text-right"><?= $money($row['taxable']) ?></td>
            <?php if ($sameState): ?>
              <td class="text-right"><?= $row['rate'] / 2 ?>%</td>
              <td class="text-right"><?= $money($row['cgst']) ?></td>
              <td class="text-right"><?= $row['rate'] / 2 ?>%</td>
              <td class="text-right"><?= $money($row['sgst']) ?></td>
            <?php else: ?>
              <td class="text-right"><?= $row['rate'] ?>%</td>
              <td class="text-right"><?= $money($row['igst']) ?></td>
            <?php endif; ?>
            <td class="text-right"><b><?= $money($row['total_tax']) ?></b></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <!-- Totals Summary & Words -->
  <div class="totals-row">
    <div class="words-box">
      <div>Amount Chargeable (in words):</div>
      <div style="font-weight:800;color:#064e3b;margin-top:4px"><?= h($wordsTotal) ?></div>
      <div style="margin-top:8px;font-size:11px;color:var(--muted)">
        All product prices are inclusive of GST. Tax rates applied: 5% (Pain Oil, Hair Oil) and 18% (Face Pack, Health Mix).
      </div>
    </div>

    <table class="totals-table">
      <tr><td>Total Taxable Value</td><td class="val"><?= $money($totTaxable) ?></td></tr>
      <?php if ($sameState): ?>
        <tr><td>Total CGST</td><td class="val"><?= $money($totCgst) ?></td></tr>
        <tr><td>Total SGST</td><td class="val"><?= $money($totSgst) ?></td></tr>
      <?php else: ?>
        <tr><td>Total IGST</td><td class="val"><?= $money($totIgst) ?></td></tr>
      <?php endif; ?>
      <?php if ($discount > 0): ?>
        <tr><td>Coupon Discount</td><td class="val" style="color:#b91c1c">−<?= $money($discount) ?></td></tr>
      <?php endif; ?>
      <tr>
        <td>Shipping &amp; Delivery</td>
        <td class="val"><?= $shipping > 0 ? $money($shipping) : '<span style="color:#059669;font-weight:700">FREE</span>' ?></td>
      </tr>
      <tr class="grand">
        <td>Total Invoice Value</td>
        <td class="val"><?= $money($grandTotal) ?></td>
      </tr>
    </table>
  </div>

  <!-- Payment Details -->
  <div class="payment-card">
    <div>
      <div style="font-size:12px;color:#166534">
        <b>Payment Status:</b> <span class="pay-status-pill"><?= strtoupper($payStatus) ?></span>
      </div>
      <div style="font-size:13px;color:#14532d;margin-top:4px">
        Method: <b><?= ($payMethod === 'cod') ? 'Cash on Delivery (COD)' : 'Razorpay Online (UPI / Card / NetBanking)' ?></b>
      </div>
    </div>
    <div style="font-size:12px;color:#166534;text-align:right">
      <?php if ($rzpPaymentId): ?>
        <div>Razorpay Ref: <b style="font-family:monospace;color:#0f172a"><?= h($rzpPaymentId) ?></b></div>
      <?php endif; ?>
      <?php if ($rzpOrderId): ?>
        <div>Order Ref: <span style="font-family:monospace"><?= h($rzpOrderId) ?></span></div>
      <?php endif; ?>
      <div>Transaction Time: <?= h(date('d M Y, h:i A', strtotime($o['created_at'] ?? 'now'))) ?></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <div>
      <b>Customer Support &amp; Care:</b><br>
      WhatsApp Helpline: <b><?= h($storePhone) ?></b> &nbsp;·&nbsp; Email: <b>care@smeram-naturals.in</b><br>
      Website: <b>smeram-naturals.in</b><br>
      <span style="font-size:10.5px;color:#94a3b8">This is an authenticated computer-generated invoice issued by <?= h($billingName) ?>.</span>
    </div>

    <div class="stamp-box">
      <div>For <b><?= h($billingName) ?></b></div>
      <div class="stamp-seal">✓ Verified GST Invoice</div>
      <div style="font-size:10.5px;color:#94a3b8;margin-top:4px">Authorized Signatory</div>
    </div>
  </div>

</div>

<?php if ($autoPrint): ?>
<script>
window.addEventListener('load', function() {
  setTimeout(function() { window.print(); }, 400);
});
</script>
<?php endif; ?>

</body>
</html>
