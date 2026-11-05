with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_dl = """    async function downloadInvoice(orderId, orderNumber) {
      try {
        // Trigger invoice issuance
        const invRes = await req('/invoices/' + orderId, { method: 'POST', body: JSON.stringify({ store_id: currentStoreId }) });
        const blob = await req('/invoices/' + invRes.invoice.id + '/pdf?store_id=' + currentStoreId, { download: true });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (invRes.invoice.invoice_number || orderNumber) + '.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 20000);
      } catch (e) {
        // Resilient fallback to direct download URL
        window.open('../api.php?route=invoices/' + orderId + '/pdf', '_blank');
      }
    }"""

new_dl = """    function downloadInvoice(orderId, orderNumber) {
      window.open('../api.php?route=invoices/' + orderId + '/pdf', '_blank');
    }"""

old_dl_id = """    async function downloadInvoiceById(invId, number) {
      try {
        const blob = await req('/invoices/' + invId + '/pdf?store_id=' + currentStoreId, { download: true });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = number + '.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 20000);
      } catch (e) {
        window.open('../api.php?route=invoices/' + invId + '/pdf', '_blank');
      }
    }"""

new_dl_id = """    function downloadInvoiceById(invId, number) {
      window.open('../api.php?route=invoices/' + invId + '/pdf', '_blank');
    }"""

if old_dl in code:
    code = code.replace(old_dl, new_dl, 1)
    print("1. downloadInvoice updated to open invoice directly.")
else:
    print("WARNING: old_dl not found.")

if old_dl_id in code:
    code = code.replace(old_dl_id, new_dl_id, 1)
    print("2. downloadInvoiceById updated to open invoice directly.")
else:
    print("WARNING: old_dl_id not found.")

with open('zkc/merchant/index.html', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: zkc/merchant/index.html updated!")

