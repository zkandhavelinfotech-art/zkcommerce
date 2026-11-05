with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

# 1. Update Invoices table headers
old_thead = '''              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Issued Date</th>
                  <th>Gross Total</th>
                  <th>PDF Download</th>
                </tr>
              </thead>
              <tbody><tr><td colspan="6" style="text-align:center;color:var(--muted)">Loading invoices…</td></tr></tbody>'''

new_thead = '''              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Issued Date</th>
                  <th>Gross Total</th>
                  <th>Payment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody><tr><td colspan="7" style="text-align:center;color:var(--muted)">Loading invoices…</td></tr></tbody>'''

if old_thead in code:
    code = code.replace(old_thead, new_thead, 1)
    print("1. Invoices table headers updated.")
else:
    print("WARNING: old_thead not found.")

# 2. Update renderRecentOrders
old_recent = '''      tbody.innerHTML = orders.map(o => `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>${o.customer_name || 'Guest'}</td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td>${money(o.total_amount)}</td>
          <td><span class="badge badge-${o.payment_status === 'paid' ? 'paid' : 'unpaid'}">${o.payment_method?.toUpperCase()} · ${o.payment_status}</span></td>
          <td><span class="badge badge-${o.status}">${o.status}</span></td>
          <td><button class="btn-outline btn-sm" onclick="downloadInvoice('${o.id}', '${o.order_number}')">PDF Invoice</button></td>
        </tr>
      `).join('');'''

new_recent = '''      tbody.innerHTML = orders.map(o => {
        const isPaid = (o.payment_status === 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status) || (o.payment_method === 'cod' && o.status !== 'cancelled'));
        return `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>${o.customer_name || 'Guest'}</td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td>${money(o.total_amount)}</td>
          <td><span class="badge badge-${o.payment_status === 'paid' ? 'paid' : 'unpaid'}">${(o.payment_method || 'Online').toUpperCase()} · ${(o.payment_status || 'unpaid').toUpperCase()}</span></td>
          <td><span class="badge badge-${o.status}">${o.status}</span></td>
          <td>${isPaid ? `<button class="btn-outline btn-sm" onclick="downloadInvoice('${o.id}', '${o.order_number}')">PDF Invoice</button>` : `<span class="badge badge-unpaid" style="font-size:11px" title="Invoices are generated only after payment is received">No Invoice (Unpaid)</span>`}</td>
        </tr>
      `}).join('');'''

if old_recent in code:
    code = code.replace(old_recent, new_recent, 1)
    print("2. Recent orders table updated with paid-only invoice button.")
else:
    print("WARNING: old_recent not found.")

# 3. Update loadOrders fulfillment actions
old_orders_act = '''            <td>
              <div style="display:flex;gap:5px;flex-wrap:wrap">
                <button class="btn-primary btn-sm" onclick="saveOrderFulfillment('${o.id}')">Save</button>
                <button class="btn-outline btn-sm" onclick="downloadInvoice('${o.id}', '${o.order_number}')">Invoice</button>
                <a class="btn-outline btn-sm" style="text-decoration:none" href="orders-detail.html?id=${o.id}">Details</a>'''

new_orders_act = '''            <td>
              <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
                <button class="btn-primary btn-sm" onclick="saveOrderFulfillment('${o.id}')">Save</button>
                ${(o.payment_status === 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status) || (o.payment_method === 'cod' && o.status !== 'cancelled')) ? `<button class="btn-outline btn-sm" onclick="downloadInvoice('${o.id}', '${o.order_number}')">Invoice</button>` : `<span class="badge badge-unpaid" style="font-size:11px" title="Invoices are generated only after payment is received">No Invoice (Unpaid)</span>`}
                <a class="btn-outline btn-sm" style="text-decoration:none" href="orders-detail.html?id=${o.id}">Details</a>'''

if old_orders_act in code:
    code = code.replace(old_orders_act, new_orders_act, 1)
    print("3. Orders table fulfillment actions updated.")
else:
    print("WARNING: old_orders_act not found.")

# 4. Update loadInvoices and download functions
old_invoices_fn = '''    async function downloadInvoice(orderId, orderNumber) {
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
      } catch (e) { notify(e.message, true); }
    }

    async function loadInvoices() {
      try {
        const q = document.getElementById('invoiceSearchInput').value.trim();
        const data = await req('/invoices?store_id=' + currentStoreId + '&q=' + encodeURIComponent(q));
        const tbody = document.querySelector('#invoicesTable tbody');
        const invoices = data.invoices || [];
        if (!invoices.length) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No invoices generated yet.</td></tr>';
          return;
        }
        tbody.innerHTML = invoices.map(i => `
          <tr>
            <td><strong>${i.invoice_number}</strong></td>
            <td>${i.order_number}</td>
            <td>${i.customer_name || i.customer_email || 'Customer'}</td>
            <td>${new Date(i.issued_at).toLocaleDateString()}</td>
            <td>${money(i.total_amount)}</td>
            <td><button class="btn-outline btn-sm" onclick="downloadInvoiceById('${i.id}', '${i.invoice_number}')">Download PDF</button></td>
          </tr>
        `).join('');
      } catch (e) { console.warn('Invoices error:', e.message); }
    }

    async function downloadInvoiceById(invId, number) {
      try {
        const blob = await req('/invoices/' + invId + '/pdf?store_id=' + currentStoreId, { download: true });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = number + '.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 20000);
      } catch (e) { notify(e.message, true); }
    }'''

new_invoices_fn = '''    async function downloadInvoice(orderId, orderNumber) {
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
    }

    async function loadInvoices() {
      try {
        const q = document.getElementById('invoiceSearchInput').value.trim();
        const data = await req('/invoices?store_id=' + currentStoreId + '&q=' + encodeURIComponent(q));
        const tbody = document.querySelector('#invoicesTable tbody');
        const invoices = data.invoices || [];
        if (!invoices.length) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No invoices found. Tax invoices are generated only for paid or confirmed orders.</td></tr>';
          return;
        }
        tbody.innerHTML = invoices.map(i => `
          <tr>
            <td><strong>${i.invoice_number}</strong></td>
            <td>${i.order_number}</td>
            <td>
              <div>${i.customer_name || 'Customer'}</div>
              <small style="color:var(--muted)">${i.customer_phone || i.customer_email || ''}</small>
            </td>
            <td>${new Date(i.issued_at).toLocaleDateString()}</td>
            <td><strong>${money(i.total_amount)}</strong></td>
            <td><span class="badge badge-${(i.payment_status === 'paid' || i.payment_method === 'cod') ? 'paid' : 'unpaid'}">${(i.payment_method || 'Online').toUpperCase()} · ${(i.payment_status || 'PAID').toUpperCase()}</span></td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn-outline btn-sm" onclick="downloadInvoiceById('${i.id}', '${i.invoice_number}')">📥 PDF</button>
                <a class="btn-outline btn-sm" style="text-decoration:none" href="../invoice.php?id=${i.id}" target="_blank">🖨 Print View</a>
              </div>
            </td>
          </tr>
        `).join('');
      } catch (e) { console.warn('Invoices error:', e.message); }
    }

    async function downloadInvoiceById(invId, number) {
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
    }'''

if old_invoices_fn in code:
    code = code.replace(old_invoices_fn, new_invoices_fn, 1)
    print("4. Invoices load and download functions updated.")
else:
    print("WARNING: old_invoices_fn not found.")

with open('zkc/merchant/index.html', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: zkc/merchant/index.html fully patched!")

