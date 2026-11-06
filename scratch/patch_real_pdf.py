import os

def patch_invoice_php(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add html2pdf script in <head>
    head_tag = '</head>'
    html2pdf_script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>\n</head>'
    if 'html2pdf' not in content and head_tag in content:
        content = content.replace(head_tag, html2pdf_script, 1)
        print(f"Added html2pdf script to {filepath}")

    # 2. Update .bar in body
    old_bar = """<div class="bar">
  <a href="admin-orders.php" class="btn btn-back">← Orders Dashboard</a>
  <button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
</div>"""

    new_bar = """<div class="bar no-print">
  <a href="javascript:history.back()" class="btn btn-back">← Back</a>
  <div style="display:flex;gap:8px">
    <button type="button" id="btnDownloadPdf" class="btn btn-primary" onclick="downloadPdfDocument()">📥 Download PDF Document (.pdf)</button>
    <button type="button" class="btn btn-back" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
</div>"""

    if old_bar in content:
        content = content.replace(old_bar, new_bar)
        print(f"Updated action bar in {filepath}")

    # 3. Add .no-print rule in CSS if not present
    if '.no-print' not in content:
        css_rule = "@media print {\n  .no-print, .bar { display: none !important; }\n}\n</style>"
        content = content.replace('</style>', css_rule, 1)
        print(f"Added .no-print CSS rule to {filepath}")

    # 4. Replace script at the bottom
    old_script = """<?php if ($autoPrint): ?>
<script>
window.addEventListener('load', function() {
  setTimeout(function() { window.print(); }, 400);
});
</script>
<?php endif; ?>"""

    new_script = """<script>
function downloadPdfDocument() {
  var btn = document.getElementById('btnDownloadPdf');
  var origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '⏳ Generating PDF...';
    btn.disabled = true;
  }

  if (typeof html2pdf !== 'undefined') {
    var element = document.querySelector('.invoice-sheet');
    var opt = {
      margin:       [8, 8, 8, 8],
      filename:     'Invoice-<?= h($invoiceNumber) ?>.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save().then(function() {
      if (btn) {
        btn.innerHTML = '✓ PDF Downloaded!';
        setTimeout(function() { btn.innerHTML = origText; btn.disabled = false; }, 3000);
      }
    }).catch(function(err) {
      console.warn('html2pdf fallback to print:', err);
      if (btn) { btn.innerHTML = origText; btn.disabled = false; }
      window.print();
    });
  } else {
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
    window.print();
  }
}

window.addEventListener('load', function() {
  var params = new URLSearchParams(window.location.search);
  var shouldDownload = params.get('download') === '1' || window.location.href.indexOf('/pdf') !== -1;
  var shouldPrint = params.get('print') === '1';

  if (shouldDownload) {
    setTimeout(function() {
      downloadPdfDocument();
    }, 600);
  } else if (shouldPrint) {
    setTimeout(function() {
      window.print();
    }, 400);
  }
});
</script>"""

    if old_script in content:
        content = content.replace(old_script, new_script)
        print(f"Updated bottom script in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {filepath}")


def patch_api_php(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    old_route = """if (preg_match('#^invoices/(\\d+)/pdf/?$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $_GET['id'] = $orderId;
    if (!isset($_GET['print'])) $_GET['print'] = '1';"""

    new_route = """if (preg_match('#^invoices/(\\d+)/pdf/?$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $_GET['id'] = $orderId;
    if (!isset($_GET['download'])) $_GET['download'] = '1';

    // Support pure binary PDF stream if requested: ?format=pdf
    if (isset($_GET['format']) && $_GET['format'] === 'pdf') {
        $tbl = function_exists('zkcGetOrdersTable') ? zkcGetOrdersTable($pdo) : 'orders';
        $o = ($pdo && function_exists('zkcOrderById')) ? zkcOrderById($pdo, $orderId) : null;
        if (!$o && $pdo) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE id = ?");
                $stmt->execute([$orderId]);
                $o = $stmt->fetch(PDO::FETCH_ASSOC);
            } catch (Exception $e) {}
        }
        $invNum = 'SM-' . str_pad($orderId, 2, '0', STR_PAD_LEFT);
        $lines = [
            "TAX INVOICE - SMERAM INDUSTRIES",
            "Billing Entity: Smeram Industries | Trade Name: Smeram Naturals",
            "GSTIN: 33DVRPR1801M1Z6 | State: Tamil Nadu (Code 33)",
            "Invoice No: " . $invNum . "   Date: " . date('d M Y', strtotime($o['created_at'] ?? 'now')),
            "Order No: " . ($o['order_number'] ?? 'ORD-' . $orderId),
            "--------------------------------------------------------------------------------",
            "BILL TO & SHIP TO:",
            "Customer: " . ($o['customer_name'] ?? 'Customer'),
            "Phone: " . ($o['customer_phone'] ?? '-') . " | Email: " . ($o['customer_email'] ?? '-'),
            "Address: " . ($o['shipping_address'] ?? '') . ", " . ($o['city'] ?? '') . ", " . ($o['state'] ?? '') . " " . ($o['pincode'] ?? ''),
            "--------------------------------------------------------------------------------",
            "Amount: INR " . number_format((float)($o['total_amount'] ?? 0), 2) . " (Inclusive of GST)",
            "Payment Status: " . strtoupper($o['payment_status'] ?? 'paid') . " | Method: " . ($o['payment_method'] ?? 'Online'),
            "--------------------------------------------------------------------------------",
            "For Smeram Industries - Authorized Signatory (Authenticated GST Invoice)"
        ];
        $pdf = zkcMakePdf($lines);
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $invNum . '.pdf"');
        header('Content-Length: ' . strlen($pdf));
        echo $pdf;
        exit;
    }"""

    if old_route in content:
        content = content.replace(old_route, new_route)
        print(f"Updated invoices/:id/pdf route in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {filepath}")


def patch_merchant_index(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    old_btn = '<a class="btn-outline btn-sm" style="text-decoration:none" href="../api.php?route=invoices/${i.id}/pdf" target="_blank" rel="noopener">📥 Open PDF</a>'
    new_btn = '<a class="btn-outline btn-sm" style="text-decoration:none" href="../api.php?route=invoices/${i.id}/pdf&download=1" target="_blank" rel="noopener">📥 Download PDF</a>'

    if old_btn in content:
        content = content.replace(old_btn, new_btn)
        print(f"Updated invoice table button in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {filepath}")


if __name__ == '__main__':
    for p in ['zkc/api/services/php/invoice.php', 'zkc/invoice.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/invoice.php', 'zkc/deployment/smeram-patch-today-v1.0.15/invoice.php']:
        patch_invoice_php(p)

    for p in ['zkc/api/services/php/api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api.php']:
        patch_api_php(p)

    for p in ['zkc/merchant/index.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/index.html']:
        patch_merchant_index(p)

