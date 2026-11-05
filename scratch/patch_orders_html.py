with open('zkc/merchant/orders.html', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_part = """    var dt = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—';

    return '<tr>'
      + '<td class="col-primary"><strong>' + ordNum + '</strong></td>'
      + '<td>' + custName + custPhone + '</td>'
      + '<td>' + (o.item_count || 1) + '</td>'
      + '<td><strong>' + total + '</strong></td>'
      + '<td><span class="badge badge-' + (payStatus === 'paid' ? 'green' : 'brand') + '">' + payMethod + ' (' + payStatus + ')</span></td>'
      + '<td><span class="status status-' + ordStatus + '">' + ordStatus + '</span></td>'
      + '<td>' + dt + '</td>'
      + '<td><div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '  <a href="orders-detail.html?id=' + o.id + '" class="btn btn-secondary btn-sm">View Details</a>'
      + '  <a href="../api.php?route=invoices/' + o.id + '/pdf" target="_blank" class="btn btn-secondary btn-sm">Invoice</a>'
      + '  <a href="' + (o.whatsapp && o.whatsapp.care_url ? o.whatsapp.care_url : ('https://wa.me/917539972026?text=' + encodeURIComponent('🛍️ Order: ' + ordNum + ' | ' + custName + ' | ' + total))) + '" target="_blank" class="btn btn-secondary btn-sm" style="color:#047857;font-weight:700">↪ Care</a>'
      + '</div></td>'
      + '</tr>';"""

new_part = """    var dt = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—';
    var isPaid = (payStatus === 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].indexOf(ordStatus) !== -1 || (payMethod === 'cod' && ordStatus !== 'cancelled'));

    return '<tr>'
      + '<td class="col-primary"><strong>' + ordNum + '</strong></td>'
      + '<td>' + custName + custPhone + '</td>'
      + '<td>' + (o.item_count || 1) + '</td>'
      + '<td><strong>' + total + '</strong></td>'
      + '<td><span class="badge badge-' + (payStatus === 'paid' ? 'green' : 'brand') + '">' + payMethod + ' (' + payStatus + ')</span></td>'
      + '<td><span class="status status-' + ordStatus + '">' + ordStatus + '</span></td>'
      + '<td>' + dt + '</td>'
      + '<td><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      + '  <a href="orders-detail.html?id=' + o.id + '" class="btn btn-secondary btn-sm">View Details</a>'
      + (isPaid ? '  <a href="../api.php?route=invoices/' + o.id + '/pdf" target="_blank" class="btn btn-secondary btn-sm">Invoice</a>' : '  <span style="font-size:11px;color:var(--zk-muted);padding:3px 6px;background:#f1f5f9;border-radius:4px" title="Invoices are generated only after payment is received">No Invoice (Unpaid)</span>')
      + '  <a href="' + (o.whatsapp && o.whatsapp.care_url ? o.whatsapp.care_url : ('https://wa.me/917539972026?text=' + encodeURIComponent('🛍️ Order: ' + ordNum + ' | ' + custName + ' | ' + total))) + '" target="_blank" class="btn btn-secondary btn-sm" style="color:#047857;font-weight:700">↪ Care</a>'
      + '</div></td>'
      + '</tr>';"""

if old_part in code:
    code = code.replace(old_part, new_part, 1)
    with open('zkc/merchant/orders.html', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: zkc/merchant/orders.html updated!")
else:
    print("ERROR: old_part not found")

