import sys

for path in ['zkc/merchant/index.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/index.html']:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Target 1: loadInvoices action buttons
    old_buttons = """              <div style="display:flex;gap:6px">
                <button class="btn-outline btn-sm" onclick="downloadInvoiceById('${i.id}', '${i.invoice_number}')">\U0001f4e5 PDF</button>
                <a class="btn-outline btn-sm" style="text-decoration:none" href="../invoice.php?id=${i.id}" target="_blank">\U0001f5a8 Print View</a>
              </div>"""

    new_buttons = """              <div style="display:flex;gap:6px">
                <a class="btn-outline btn-sm" style="text-decoration:none" href="../api.php?route=invoices/${i.id}/pdf" target="_blank" rel="noopener">\U0001f4e5 Open PDF</a>
                <a class="btn-outline btn-sm" style="text-decoration:none" href="../invoice.php?id=${i.id}&print=1" target="_blank" rel="noopener">\U0001f5a8 Print View</a>
              </div>"""

    if old_buttons in content:
        content = content.replace(old_buttons, new_buttons, 1)
        print('Updated buttons in', path)
    else:
        print('Target buttons not found in', path)

    # Target 2: downloadInvoice
    old_dl = "window.open('../api.php?route=invoices/' + orderId + '/pdf', '_blank');"
    new_dl = "window.open('../api.php?route=invoices/' + encodeURIComponent(orderId) + '/pdf', '_blank');"
    if old_dl in content:
        content = content.replace(old_dl, new_dl)
        print('Updated downloadInvoice in', path)

    # Target 3: downloadInvoiceById
    old_dl_id = "window.open('../api.php?route=invoices/' + invId + '/pdf', '_blank');"
    new_dl_id = "window.open('../api.php?route=invoices/' + encodeURIComponent(invId) + '/pdf', '_blank');"
    if old_dl_id in content:
        content = content.replace(old_dl_id, new_dl_id)
        print('Updated downloadInvoiceById in', path)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
