with open('zkc/merchant/packaging.html', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

# 1. Update Chips buttons
old_chips = """      <div class="chips">
        <button class="btn sm" data-range="0">Today</button>
        <button class="btn sm" data-range="1">Yesterday</button>
        <button class="btn sm" data-range="7">Last 7 days</button>
        <button class="btn sm" data-range="30">Last 30 days</button>
      </div>"""

new_chips = """      <div class="chips" id="rangeChips">
        <button type="button" class="btn sm" data-range="0" style="background:#059669;color:#fff;font-weight:700;border:1px solid #047857;cursor:pointer">📅 Today</button>
        <button type="button" class="btn sm" data-range="1" style="background:#0284c7;color:#fff;font-weight:600;border:1px solid #0369a1;cursor:pointer">Yesterday</button>
        <button type="button" class="btn sm" data-range="7" style="background:#4f46e5;color:#fff;font-weight:700;border:1px solid #3730a3;box-shadow:0 0 0 2px #c7d2fe;cursor:pointer">⭐ Last 7 days (Default)</button>
        <button type="button" class="btn sm" data-range="30" style="background:#475569;color:#fff;font-weight:600;border:1px solid #334155;cursor:pointer">Last 30 days</button>
      </div>"""

if old_chips in code:
    code = code.replace(old_chips, new_chips, 1)
    print("1. Chips buttons updated with distinct colors.")
else:
    print("WARNING: old_chips not found.")

# 2. Update renderRows Order column to show '📦 Ready to Pack' badge
old_order_col = """      <td><b>${esc(o.order_number || '#' + o.id)}</b><div class="muted">${esc(new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</div><div class="muted">${esc(o.status)}</div></td>"""

new_order_col = """      <td>
        <b>${esc(o.order_number || '#' + o.id)}</b>
        <div class="muted">${esc(new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</div>
        <div>
          ${(o.status === 'confirmed' || o.status === 'new') 
            ? '<span class="pill" style="background:#ecfdf5;color:#047857;border:1.5px solid #34d399;font-weight:800;font-size:11px;padding:3px 9px;display:inline-block;margin-top:4px;border-radius:12px">📦 Ready to Pack</span>' 
            : (o.status === 'processing' 
              ? '<span class="pill" style="background:#eff6ff;color:#1e40af;border:1.5px solid #93c5fd;font-weight:700;font-size:11px;padding:3px 9px;display:inline-block;margin-top:4px;border-radius:12px">✔ Packed</span>' 
              : '<span class="pill" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;font-weight:700;font-size:11px;padding:3px 9px;display:inline-block;margin-top:4px;border-radius:12px">' + esc(o.status) + '</span>')}
        </div>
      </td>"""

if old_order_col in code:
    code = code.replace(old_order_col, new_order_col, 1)
    print("2. Order column updated with Ready to Pack badge.")
else:
    print("WARNING: old_order_col not found.")

# 3. Update default dates to last 7 days and active chip state
old_dates_init = "document.getElementById('fromDate').value = document.getElementById('toDate').value = istDate(0);"
new_dates_init = """document.getElementById('fromDate').value = istDate(7);
document.getElementById('toDate').value = istDate(0);"""

if old_dates_init in code:
    code = code.replace(old_dates_init, new_dates_init, 1)
    print("3. Default dates updated to last 7 days.")
else:
    print("WARNING: old_dates_init not found.")

old_range_click = """document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {
  const n = Number(b.dataset.range);
  document.getElementById('fromDate').value = istDate(n === 1 ? 1 : n ? n - 1 : 0);
  document.getElementById('toDate').value = istDate(n === 1 ? 1 : 0);
  load();
});"""

new_range_click = """document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {
  const n = Number(b.dataset.range);
  document.getElementById('fromDate').value = istDate(n === 1 ? 1 : n ? n : 0);
  document.getElementById('toDate').value = istDate(n === 1 ? 1 : 0);
  document.querySelectorAll('[data-range]').forEach(btn => btn.style.boxShadow = 'none');
  b.style.boxShadow = '0 0 0 3px #fbbf24';
  load();
});"""

if old_range_click in code:
    code = code.replace(old_range_click, new_range_click, 1)
    print("4. Range button click with active outline updated.")
else:
    print("WARNING: old_range_click not found.")

with open('zkc/merchant/packaging.html', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: packaging.html fully updated!")

