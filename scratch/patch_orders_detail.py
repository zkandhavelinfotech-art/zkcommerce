with open('zkc/merchant/orders-detail.html', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_fn = """function openInvoice() {
  var oid = getOrderId();
  if (!oid) return;
  // Open real invoice PDF / print view
  window.open('../api.php?route=invoices/' + oid + '/pdf', '_blank');
}"""

new_fn = """function openInvoice() {
  var oid = getOrderId();
  if (!oid) return;
  if (CURRENT_ORDER) {
    var pStatus = (CURRENT_ORDER.payment_status || '').toLowerCase();
    var oStatus = (CURRENT_ORDER.order_status || CURRENT_ORDER.status || '').toLowerCase();
    var pMethod = (CURRENT_ORDER.payment_method || '').toLowerCase();
    var isPaid = (pStatus === 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].indexOf(oStatus) !== -1 || (pMethod === 'cod' && oStatus !== 'cancelled'));
    if (!isPaid) {
      alert('Tax Invoice is unavailable: This order is pending payment. Invoices are generated only after payment is received.');
      return;
    }
  }
  // Open real invoice PDF / print view
  window.open('../api.php?route=invoices/' + oid + '/pdf', '_blank');
}"""

old_inv_render = "  setEl('invoice-number', o.invoice_number || ('ZK-2-' + o.id));"
new_inv_render = """  var pStatus = (o.payment_status || '').toLowerCase();
  var oStatus = (o.order_status || o.status || '').toLowerCase();
  var pMethod = (o.payment_method || '').toLowerCase();
  var isPaid = (pStatus === 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].indexOf(oStatus) !== -1 || (pMethod === 'cod' && oStatus !== 'cancelled'));
  setEl('invoice-number', isPaid ? (o.invoice_number || ('ZK-2-' + o.id)) : 'Pending Payment (No Invoice)');
  var btnInvTop = document.getElementById('btn-invoice');
  if (btnInvTop && !isPaid) {
    btnInvTop.style.opacity = '0.5';
    btnInvTop.title = 'Invoices are generated only after payment is received';
  }"""

if old_fn in code:
    code = code.replace(old_fn, new_fn, 1)
    print("1. openInvoice updated.")
else:
    print("WARNING: old_fn not found.")

if old_inv_render in code:
    code = code.replace(old_inv_render, new_inv_render, 1)
    print("2. invoice-number render updated.")
else:
    print("WARNING: old_inv_render not found.")

with open('zkc/merchant/orders-detail.html', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: orders-detail.html updated!")

