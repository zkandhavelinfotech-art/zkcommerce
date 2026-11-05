path = 'zkc/store-builder/index.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add GST fields into productForm
target_inputs = '<label>Stock Quantity (Units) *<input name="quantity" id="productQuantity" type="number" min="0" value="100" required placeholder="100" style="font-weight:700"></label>'

replacement_inputs = '<label>Stock Quantity (Units) *<input name="quantity" id="productQuantity" type="number" min="0" value="100" required placeholder="100" style="font-weight:700"></label><label>GST Rate (%) *<select name="gst_rate" id="productGstRate" onchange="updateSbGst()"><option value="5" selected>5% — Pain Oil &amp; Hair Oil (Ayurvedic/Siddha)</option><option value="18">18% — Face Pack &amp; Health Mix (Cosmetics/Food)</option><option value="0">0% — Nil / Exempted</option><option value="12">12% — Standard Goods</option><option value="28">28% — Luxury Goods</option></select></label><label>HSN / SAC Code *<input name="hsn_code" id="productHsnCode" placeholder="30049013" value="30049013" style="font-weight:600;font-family:monospace"></label>'

if target_inputs in c and 'productGstRate' not in c:
    c = c.replace(target_inputs, replacement_inputs)
    print("Added GST inputs to store-builder productForm")

# 2. Add GST live breakdown box into productForm
target_banner = '<label style="grid-column:1/-1">Badge / Method Banner<input name="badge_text" maxlength="60" placeholder="e.g. Sneha - Kalka - Drava Method · Cold Pressed"></label></div></div>'

gst_box_html = """<div id="sb-gst-calc-box" style="grid-column:1/-1;background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:12px 14px;margin-top:4px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:12px;font-weight:800;color:#166534">🧾 Inclusive GST Math Breakdown (Smeram Industries)</div>
    <span class="badge" id="sb-calc-rate-badge" style="background:#059669;color:#fff;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">5% GST</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;font-size:11.5px;background:#fff;padding:8px 12px;border-radius:6px;border:1px solid #BBF7D0">
    <div><div style="color:#64748B;font-size:10.5px">Selling Price</div><strong id="sb-calc-gross" style="color:#0F172A">₹349.00</strong></div>
    <div><div style="color:#64748B;font-size:10.5px">Taxable Base</div><strong id="sb-calc-taxable" style="color:#1E40AF">₹332.38</strong></div>
    <div><div style="color:#64748B;font-size:10.5px">CGST + SGST</div><strong id="sb-calc-cgst-sgst" style="color:#059669">₹8.31 + ₹8.31</strong></div>
    <div><div style="color:#64748B;font-size:10.5px">Total GST</div><strong id="sb-calc-total-gst" style="color:#059669">₹16.62</strong></div>
  </div>
  <div style="font-size:10.5px;color:#166534;margin-top:6px" id="sb-calc-formula">Formula: Taxable = Gross × 100 / (100 + Rate)</div>
</div>"""

replacement_banner = '<label style="grid-column:1/-1">Badge / Method Banner<input name="badge_text" maxlength="60" placeholder="e.g. Sneha - Kalka - Drava Method · Cold Pressed"></label>' + gst_box_html + '</div></div>'

if target_banner in c and 'sb-gst-calc-box' not in c:
    c = c.replace(target_banner, replacement_banner)
    print("Added GST box to store-builder productForm")

# 3. Add updateSbGst function and hook into openProduct and saveProduct
sb_gst_fn = """
function updateSbGst() {
  const f = document.getElementById('productForm');
  if (!f) return;
  const p = parseFloat(f.elements.price?.value || 0) || 0;
  const r = parseFloat(f.elements.gst_rate?.value || 5) || 5;
  const taxable = Math.round(p * 10000 / (100 + r)) / 100;
  const gst = Math.round((p - taxable) * 100) / 100;
  const half = Math.round((gst / 2) * 100) / 100;

  const gEl = document.getElementById('sb-calc-gross');
  const tEl = document.getElementById('sb-calc-taxable');
  const csEl = document.getElementById('sb-calc-cgst-sgst');
  const tgEl = document.getElementById('sb-calc-total-gst');
  const rbEl = document.getElementById('sb-calc-rate-badge');
  const fEl = document.getElementById('sb-calc-formula');

  if (gEl) gEl.textContent = '₹' + p.toFixed(2);
  if (tEl) tEl.textContent = '₹' + taxable.toFixed(2);
  if (csEl) csEl.textContent = '₹' + half.toFixed(2) + ' + ₹' + half.toFixed(2);
  if (tgEl) tgEl.textContent = '₹' + gst.toFixed(2);
  if (rbEl) rbEl.textContent = r + '% GST';
  if (fEl) fEl.innerHTML = 'Formula: Taxable = ' + p + ' × 100 / ' + (100 + r) + ' = <strong>₹' + taxable.toFixed(2) + '</strong> (GST: <strong>₹' + gst.toFixed(2) + '</strong>)';
}
"""

if 'function updateSbGst' not in c:
    c = c.replace("function openProduct(p){", sb_gst_fn + "\nfunction openProduct(p){")

# Hook into openProduct:
target_open = "f.elements.product_size.value=p?.product_size||p?.size||'';"
replacement_open = "f.elements.product_size.value=p?.product_size||p?.size||'';if(f.elements.gst_rate)f.elements.gst_rate.value=p?.gst_rate!=null?p.gst_rate:5;if(f.elements.hsn_code)f.elements.hsn_code.value=p?.hsn_code||(p?.gst_rate==18?'33049990':'30049013');updateSbGst();"

if target_open in c:
    c = c.replace(target_open, replacement_open)
    print("Hooked GST into store-builder openProduct")

# Hook price oninput
target_price_input = '<label>Price (₹) *<input name="price" type="number" min="0" required placeholder="299"></label>'
replacement_price_input = '<label>Price (₹) *<input name="price" type="number" min="0" required placeholder="299" oninput="updateSbGst()"></label>'
if target_price_input in c:
    c = c.replace(target_price_input, replacement_price_input)

# Hook into saveProduct:
target_save = "quantity:v.quantity!==undefined&&v.quantity!==''?Math.max(0,parseInt(v.quantity,10)):100,"
replacement_save = "quantity:v.quantity!==undefined&&v.quantity!==''?Math.max(0,parseInt(v.quantity,10)):100,stock:v.quantity!==undefined&&v.quantity!==''?Math.max(0,parseInt(v.quantity,10)):100,gst_rate:Number(v.gst_rate||5),hsn_code:v.hsn_code?.trim()||'30049013',"

if target_save in c:
    c = c.replace(target_save, replacement_save)
    print("Hooked GST into store-builder saveProduct")

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated store-builder/index.html successfully!")

