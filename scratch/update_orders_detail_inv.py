with open('zkc/merchant/orders-detail.html', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_str = "setEl('invoice-number', isPaid ? (o.invoice_number || ('ZK-2-' + o.id)) : 'Pending Payment (No Invoice)');"
new_str = "var invFormatted = o.invoice_number || ('SM-' + String(o.id).padStart(2, '0')); setEl('invoice-number', isPaid ? invFormatted : 'Pending Payment (No Invoice)');"

if old_str in code:
    code = code.replace(old_str, new_str, 1)
    with open('zkc/merchant/orders-detail.html', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: orders-detail.html updated!")
else:
    print("WARNING: old_str not found")

