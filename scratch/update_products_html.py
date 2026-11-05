import re

path = 'zkc/merchant/products.html'

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update Table Headers
old_thead = """          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Category</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>"""

new_thead = """          <tr>
            <th>Product</th>
            <th>SKU &amp; HSN</th>
            <th>Price (Incl. GST)</th>
            <th>Taxable Base</th>
            <th>GST Breakup</th>
            <th>Stock</th>
            <th>Category</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>"""

html = html.replace(old_thead, new_thead)

# 2. Update Modal Section 2: Pricing & Inventory (add HSN and Live GST breakdown)
old_sec2 = """      <!-- Section 2: Pricing & Inventory -->
      <div class="modal-section">
        <div class="modal-sec-title">💰 Pricing & Inventory</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-group">
            <label class="field-label">Selling Price (₹) *</label>
            <input type="number" class="field" id="modal-pprice" placeholder="499" style="font-weight:700">
          </div>
          <div class="field-group">
            <label class="field-label">MRP / Compare Price (₹)</label>
            <input type="number" class="field" id="modal-pmrp" placeholder="699">
          </div>
          <div class="field-group">
            <label class="field-label">Stock Quantity *</label>
            <input type="number" class="field" id="modal-pstock" placeholder="150" style="font-weight:700">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group">
            <label class="field-label">Status</label>
            <select class="field" id="modal-pstatus">
              <option value="published">Published (Active on Store)</option>
              <option value="draft">Draft (Hidden)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">GST Rate</label>
            <select class="field" id="modal-pgrate">
              <option value="0">0%</option>
              <option value="5">5% — Ayurvedic & Essentials</option>
              <option value="12" selected>12% — Personal Care / Fashion</option>
              <option value="18">18% — Cosmetics</option>
            </select>
          </div>
        </div>
      </div>"""

new_sec2 = """      <!-- Section 2: Pricing & Inventory with Smeram GST Breakup -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>💰 Pricing, Inventory &amp; Inclusive GST</span>
          <span class="badge badge-green" style="font-size:11px">Smeram Industries Inclusive GST</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-group">
            <label class="field-label">Selling Price (Gross ₹) *</label>
            <input type="number" class="field" id="modal-pprice" placeholder="349" style="font-weight:700" oninput="updateModalGstBreakdown()">
            <div style="font-size:11px;color:var(--zk-muted);margin-top:2px">Inclusive of all taxes</div>
          </div>
          <div class="field-group">
            <label class="field-label">MRP / Compare Price (₹)</label>
            <input type="number" class="field" id="modal-pmrp" placeholder="499">
          </div>
          <div class="field-group">
            <label class="field-label">Stock Quantity (Units) *</label>
            <input type="number" class="field" id="modal-pstock" placeholder="120" style="font-weight:700">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-group">
            <label class="field-label">GST Rate (%) *</label>
            <select class="field" id="modal-pgrate" onchange="updateModalGstBreakdown()" style="font-weight:600">
              <option value="5">5% — Pain Oil &amp; Hair Oil (Ayurvedic/Siddha)</option>
              <option value="18">18% — Face Pack &amp; Health Mix (Cosmetics/Food)</option>
              <option value="0">0% — Nil / Exempted</option>
              <option value="12">12% — Standard Goods</option>
              <option value="28">28% — Luxury Goods</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">HSN / SAC Code *</label>
            <input type="text" class="field" id="modal-phsn" placeholder="30049013" style="font-weight:600">
            <div style="font-size:11px;color:var(--zk-muted);margin-top:2px">e.g. 30049013 / 33059019</div>
          </div>
          <div class="field-group">
            <label class="field-label">Status</label>
            <select class="field" id="modal-pstatus">
              <option value="published">Published (Active on Store)</option>
              <option value="draft">Draft (Hidden)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <!-- Live Inclusive GST Breakdown Card -->
        <div id="modal-gst-calc-box" style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:14px 16px;margin-top:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:12.5px;font-weight:800;color:#166534;display:flex;align-items:center;gap:6px">
              <span>🧾</span>
              <span>Inclusive GST Breakdown Preview</span>
            </div>
            <span class="badge badge-green" id="modal-calc-rate-badge" style="font-weight:800">5% GST</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;font-size:12px;background:#fff;padding:10px 14px;border-radius:8px;border:1px solid #BBF7D0">
            <div>
              <div style="color:#64748B;font-size:11px;margin-bottom:2px">Gross Selling Price</div>
              <div style="font-weight:800;font-size:14px;color:#0F172A" id="modal-calc-gross">₹349.00</div>
            </div>
            <div>
              <div style="color:#64748B;font-size:11px;margin-bottom:2px">Taxable Base Value</div>
              <div style="font-weight:800;font-size:14px;color:#1E40AF" id="modal-calc-taxable">₹332.38</div>
            </div>
            <div>
              <div style="color:#64748B;font-size:11px;margin-bottom:2px">CGST + SGST (TN 33)</div>
              <div style="font-weight:800;font-size:13px;color:#059669" id="modal-calc-cgst-sgst">₹8.31 + ₹8.31</div>
            </div>
            <div>
              <div style="color:#64748B;font-size:11px;margin-bottom:2px">Total GST Tax</div>
              <div style="font-weight:800;font-size:14px;color:#059669" id="modal-calc-total-gst">₹16.62</div>
            </div>
          </div>
          <div style="font-size:11px;color:#166534;margin-top:8px;line-height:1.4" id="modal-calc-formula">
            Formula: Taxable = Product Price × 100 / (100 + Rate) = ₹349.00 × 100 / 105 = <strong>₹332.38</strong> (GST: <strong>₹16.62</strong>)
          </div>
        </div>

      </div>"""

html = html.replace(old_sec2, new_sec2)

# 3. Update PRODUCTS_LIST array
old_catalog_start = "var PRODUCTS_LIST = ["
old_catalog_end = "// Render Products Table"

p_start_idx = html.find(old_catalog_start)
p_end_idx = html.find(old_catalog_end)

if p_start_idx != -1 and p_end_idx != -1:
    new_products_block = """var PRODUCTS_LIST = [
  {
    id: 1,
    name: "Smeram Siddha Ortho Pain Relief Thailam (Joint Care)",
    sku: "SM-PO-100",
    hsn_code: "30049013",
    price: 349,
    mrp: 499,
    gst_rate: 5,
    stock: 120,
    category_name: "Joint Care & Pain Relief",
    brand: "Smeram Naturals",
    status: "published",
    created_at: new Date().toISOString(),
    description: "Traditional Siddha herbal pain relief thailam formulated with 24 potent anti-inflammatory botanicals, Mahanarayan thailam, wintergreen, and camphor. Rapid deep tissue penetration for arthritic knee pain, joint stiffness, muscular spasms, and backache.",
    user_instructions: "Apply 5-10 ml gently over affected joints or muscles. Massage in circular motions for 5 minutes. Apply a warm compress for enhanced relief. Use 2-3 times daily.",
    benefits: "• Instant cooling sensation followed by deep warming relief\\n• Clinically proven to reduce joint stiffness and inflammation\\n• 100% Classical Siddha herbal formulation (HSN 30049013 - 5% GST)\\n• Free from synthetic NSAIDs and artificial perfumes",
    additional_note: "Inclusive of 5% GST and free shipping."
  },
  {
    id: 2,
    name: "Smeram Naturals 100% Herbal Siddha Hair Oil (200ml)",
    sku: "SM-HO-200",
    hsn_code: "33059019",
    price: 299,
    mrp: 449,
    gst_rate: 5,
    stock: 85,
    category_name: "Hair Care",
    brand: "Smeram Naturals",
    status: "published",
    created_at: new Date(Date.now() - 86400000*2).toISOString(),
    description: "Smeram 100% Natural Herbal Hair Oil is deeply infused with 18 vital ayurvedic herbs including Bhringraj, Amla, Brahmi, Hibiscus, Fenugreek, and cold-pressed Virgin Coconut Oil. Prepared using traditional slow-heat extraction to retain potent phytochemicals that nourish hair follicles, reduce hair thinning, and restore natural shine and density.",
    user_instructions: "Take 5-10 ml of Smeram Herbal Hair Oil. Warm gently between palms and apply directly to scalp. Massage with circular fingertip motions for 10 minutes to stimulate blood circulation. Leave on for at least 1-2 hours or overnight for deep root nourishment. Wash off thoroughly with a mild herbal shampoo. Recommended 3 times weekly.",
    benefits: "• Clinically proven to reduce hair fall and strengthen root follicles\\n• Deeply conditions scalp, preventing dry flaking and stubborn dandruff\\n• 100% pure cold-pressed natural herbal formulation (HSN 33059019 - 5% GST)\\n• Free from mineral oil, silicones, artificial fragrance, and parabens",
    additional_note: "Inclusive of 5% GST and free shipping."
  },
  {
    id: 3,
    name: "Smeram Ayurgold Kumkumadi Face Glow Oil & Herbal Pack",
    sku: "SM-FP-050",
    hsn_code: "33049990",
    price: 499,
    mrp: 699,
    gst_rate: 18,
    stock: 65,
    category_name: "Skin Care & Face Pack",
    brand: "Smeram Naturals",
    status: "published",
    created_at: new Date(Date.now() - 86400000*5).toISOString(),
    description: "Authentic Kashmiri Saffron, Red Sandalwood, Manjistha, and goat milk concoction. Illuminates complexion, lightens hyperpigmentation, smooths uneven skin tone, and provides a radiant Ayurvedic bridal glow.",
    user_instructions: "Wash face thoroughly with gentle cleanser. Dispense 3-4 drops onto palms and pat gently across face and neck. Massage upwards until absorbed. For face pack, mix 1 tbsp with rosewater, apply for 15 mins and rinse.",
    benefits: "• Reduces dark spots, acne scars, and blemish pigmentation\\n• Enriched with pure Kashmiri Kumkuma (Saffron)\\n• Premium cosmetic Ayurvedic formulation (HSN 33049990 - 18% GST)\\n• 100% preservative-free, non-comedogenic",
    additional_note: "Inclusive of 18% GST and free shipping."
  },
  {
    id: 4,
    name: "Smeram Vedic Multi-Grain Health Mix & Desi Gir Cow Ghee (500g)",
    sku: "SM-HM-500",
    hsn_code: "19011099",
    price: 799,
    mrp: 999,
    gst_rate: 18,
    stock: 50,
    category_name: "Vedic Health Foods",
    brand: "Smeram Naturals",
    status: "published",
    created_at: new Date(Date.now() - 86400000*8).toISOString(),
    description: "Traditional sprouted multi-millet, sprouted grains, nuts, and cardamom nutritious health mix paired with pure bilona churned A2 Vedic Desi Gir Cow Ghee. Provides complete sustained energy, gut nourishment, and immunity for children and adults.",
    user_instructions: "Mix 2 tablespoons of health mix with 200ml cold milk or water. Cook on low flame for 3-5 minutes stirring continuously. Add 1 teaspoon of A2 Desi Ghee and jaggery to taste.",
    benefits: "• Sprouted 24 nutritious grains, millets, pulses, and dry fruits\\n• High protein, dietary fiber, and natural calcium\\n• Wholesome dietary nourishment (HSN 19011099 - 18% GST)\\n• Zero added sugar, zero preservatives, 100% natural",
    additional_note: "Inclusive of 18% GST and free shipping."
  }
];

"""
    html = html[:p_start_idx] + new_products_block + html[p_end_idx:]

# 4. Update renderProductsTable function to show Taxable Base and GST Breakup
old_render_fn_start = "function renderProductsTable(products) {"
old_render_fn_end = "// ─── MODAL OPEN / POPULATE / CLOSE"

r_start_idx = html.find(old_render_fn_start)
r_end_idx = html.find(old_render_fn_end)

if r_start_idx != -1 and r_end_idx != -1:
    new_render_fn = """function renderProductsTable(products) {
  var tbody = document.getElementById('products-body');
  if (!tbody) return;

  if (!products || !products.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--zk-muted)">No products found. <a href="products-add.html" style="color:var(--zk-fire);font-weight:700">+ Add your first product</a></td></tr>';
    return;
  }

  tbody.innerHTML = products.map(function(p) {
    var hasInstructions = !!(p.user_instructions && p.user_instructions.trim());
    var hasBenefits     = !!(p.benefits && p.benefits.trim());
    var hasNote         = !!(p.additional_note && p.additional_note.trim());

    var rate = parseFloat(p.gst_rate !== undefined ? p.gst_rate : 5.0);
    var gross = parseFloat(p.price || 0);
    // Inclusive GST formula: Taxable = Gross * 100 / (100 + Rate)
    var taxable = Math.round(gross * 10000 / (100 + rate)) / 100;
    var totalGst = Math.round((gross - taxable) * 100) / 100;
    var halfGst = Math.round((totalGst / 2) * 100) / 100;
    var hsn = p.hsn_code || (rate === 5 ? '30049013' : '33049990');
    var stockQty = (p.quantity !== undefined && p.quantity !== null) ? p.quantity : (p.stock !== undefined ? p.stock : 100);

    return '<tr id="row-prod-' + p.id + '">'
      + '<td>'
      +   '<div style="display:flex;align-items:center;gap:12px">'
      +     '<div style="width:42px;height:42px;border-radius:9px;background:' + (rate === 5 ? '#DCFCE7' : '#FEF3C7') + ';display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">'
      +       (p.category_name.includes('Hair') ? '🌿' : (p.category_name.includes('Joint') || p.category_name.includes('Pain') ? '🩹' : (p.category_name.includes('Skin') || p.category_name.includes('Face') ? '✨' : '🌾')))
      +     '</div>'
      +     '<div>'
      +       '<div style="font-weight:700;font-size:13.5px;color:var(--zk-text)">' + p.name + '</div>'
      +       '<div style="font-size:11px;color:var(--zk-dim);display:flex;gap:6px;align-items:center;margin-top:2px">'
      +         '<span>' + (p.brand || 'Smeram Naturals') + '</span>'
      +         (hasInstructions ? '<span style="color:#2563EB" title="User Instructions Configured">📋 Instructions</span>' : '')
      +         (hasBenefits ? '<span style="color:#059669" title="Key Benefits Configured">⭐ Benefits</span>' : '')
      +         (hasNote ? '<span style="color:#D97706" title="Inclusive GST Note">🏷️ Free shipping</span>' : '')
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-size:12px;font-family:monospace;font-weight:700;color:var(--zk-text)">' + (p.sku || ('SM-0' + p.id)) + '</div>'
      +   '<div style="font-size:11px;color:var(--zk-muted);font-weight:600">HSN: ' + hsn + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:800;font-size:14px;color:var(--zk-text)">' + fmt.inr(gross) + '</div>'
      +   (p.mrp ? '<div style="font-size:11px;color:var(--zk-dim);text-decoration:line-through">' + fmt.inr(p.mrp) + '</div>' : '')
      +   '<div style="font-size:10.5px;font-weight:700;color:#059669">Incl. GST</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:800;font-size:13.5px;color:#1E40AF">' + fmt.inr(taxable) + '</div>'
      +   '<div style="font-size:10.5px;color:var(--zk-dim)">' + gross + ' × 100/' + (100 + rate) + '</div>'
      + '</td>'
      + '<td>'
      +   '<span class="badge ' + (rate === 5 ? 'badge-green' : 'badge-indigo') + '" style="font-weight:800">' + rate + '% GST</span>'
      +   '<div style="font-size:11px;font-weight:700;color:#059669;margin-top:2px">₹' + totalGst.toFixed(2) + '</div>'
      +   '<div style="font-size:10px;color:var(--zk-muted)">CGST ' + (rate/2) + '%: ₹' + halfGst.toFixed(2) + '<br>SGST ' + (rate/2) + '%: ₹' + halfGst.toFixed(2) + '</div>'
      + '</td>'
      + '<td><span class="badge ' + (stockQty <= 10 ? 'badge-amber' : 'badge-green') + '" style="font-weight:800">' + stockQty + ' units</span></td>'
      + '<td><span style="font-size:12px;font-weight:600">' + (p.category_name || 'Herbal') + '</span></td>'
      + '<td><span class="status status-' + (p.status === 'published' ? 'delivered' : 'processing') + '">' + (p.status === 'published' ? 'Active' : 'Draft') + '</span></td>'
      + '<td>'
      +   '<div style="display:flex;gap:6px">'
      +     '<button class="btn btn-secondary btn-sm" onclick="openEditModal(' + p.id + ')" style="font-weight:700">✏️ Edit</button>'
      +     '<a href="products-add.html?id=' + p.id + '" class="btn btn-ghost btn-sm" title="Full page editor" style="color:var(--zk-muted)">↗</a>'
      +   '</div>'
      + '</td>'
      + '</tr>';
  }).join('');

  var totEl = document.getElementById('products-total-label');
  if (totEl) totEl.textContent = 'Showing ' + products.length + ' Smeram products';
}

"""
    html = html[:r_start_idx] + new_render_fn + html[r_end_idx:]

# 5. Add updateModalGstBreakdown helper and update openEditModal & saveProductFromModal
extra_js = """
// Live calculation of inclusive GST inside modal
function updateModalGstBreakdown() {
  var pInput = document.getElementById('modal-pprice');
  var rSelect = document.getElementById('modal-pgrate');
  var gross = parseFloat(pInput ? pInput.value : 0) || 0;
  var rate = parseFloat(rSelect ? rSelect.value : 5) || 5;

  var taxable = Math.round(gross * 10000 / (100 + rate)) / 100;
  var gst = Math.round((gross - taxable) * 100) / 100;
  var half = Math.round((gst / 2) * 100) / 100;

  var gEl = document.getElementById('modal-calc-gross');
  var tEl = document.getElementById('modal-calc-taxable');
  var csEl = document.getElementById('modal-calc-cgst-sgst');
  var tgEl = document.getElementById('modal-calc-total-gst');
  var rbEl = document.getElementById('modal-calc-rate-badge');
  var fEl = document.getElementById('modal-calc-formula');

  if (gEl) gEl.textContent = fmt.inr(gross);
  if (tEl) tEl.textContent = fmt.inr(taxable);
  if (csEl) csEl.textContent = '₹' + half.toFixed(2) + ' + ₹' + half.toFixed(2);
  if (tgEl) tgEl.textContent = '₹' + gst.toFixed(2);
  if (rbEl) rbEl.textContent = rate + '% GST';
  if (fEl) {
    fEl.innerHTML = 'Formula: Taxable = Gross × 100 / (100 + ' + rate + ') = ' + fmt.inr(gross) + ' × 100 / ' + (100 + rate) + ' = <strong>' + fmt.inr(taxable) + '</strong> (GST: <strong>₹' + gst.toFixed(2) + '</strong>)';
  }
}
"""

# Let's find openEditModal and update its population
old_open_modal = """  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('modal-pname').value   = p.name || '';
  document.getElementById('modal-pdesc').value   = p.description || '';
  document.getElementById('modal-pprice').value  = p.price || '';
  document.getElementById('modal-pmrp').value    = p.mrp || '';
  document.getElementById('modal-pstock').value  = (p.quantity !== undefined && p.quantity !== null) ? p.quantity : (p.stock !== undefined ? p.stock : 100);
  document.getElementById('modal-pcat').value    = p.category_name || 'Hair Care';
  document.getElementById('modal-pbrand').value  = p.brand || '';
  document.getElementById('modal-pstatus').value = p.status || 'published';
  document.getElementById('modal-status-badge').textContent = (p.status === 'published' ? 'Active' : 'Draft');"""

new_open_modal = """  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('modal-pname').value   = p.name || '';
  document.getElementById('modal-pdesc').value   = p.description || '';
  document.getElementById('modal-pprice').value  = p.price || '';
  document.getElementById('modal-pmrp').value    = p.mrp || '';
  document.getElementById('modal-pstock').value  = (p.quantity !== undefined && p.quantity !== null) ? p.quantity : (p.stock !== undefined ? p.stock : 100);
  document.getElementById('modal-pcat').value    = p.category_name || 'Hair Care';
  document.getElementById('modal-pbrand').value  = p.brand || 'Smeram Naturals';
  document.getElementById('modal-pstatus').value = p.status || 'published';
  document.getElementById('modal-status-badge').textContent = (p.status === 'published' ? 'Active' : 'Draft');

  var rate = (p.gst_rate !== undefined && p.gst_rate !== null) ? p.gst_rate : 5;
  document.getElementById('modal-pgrate').value = rate;
  document.getElementById('modal-phsn').value = p.hsn_code || (rate == 5 ? '30049013' : '33049990');
  updateModalGstBreakdown();"""

html = html.replace(old_open_modal, new_open_modal)

# Let's find saveProductFromModal and update payload
old_save_payload = """  var payload = {
    name: name,
    description: desc,
    price: price,
    mrp: mrp,
    stock: stock,
    quantity: stock,
    category_name: cat,
    brand: brand,
    status: status,
    additional_note: noteVal,
    user_instructions: instVal,
    benefits: benVal
  };"""

new_save_payload = """  var gstRate = parseFloat(document.getElementById('modal-pgrate').value) || 5;
  var hsnCode = document.getElementById('modal-phsn').value.trim() || (gstRate == 5 ? '30049013' : '33049990');

  var payload = {
    name: name,
    description: desc,
    price: price,
    mrp: mrp,
    stock: stock,
    quantity: stock,
    category_name: cat,
    brand: brand,
    status: status,
    gst_rate: gstRate,
    hsn_code: hsnCode,
    additional_note: noteVal,
    user_instructions: instVal,
    benefits: benVal
  };"""

html = html.replace(old_save_payload, new_save_payload)

# Insert updateModalGstBreakdown before openEditModal
html = html.replace("// ─── MODAL OPEN / POPULATE / CLOSE", extra_js + "\n// ─── MODAL OPEN / POPULATE / CLOSE")

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated products.html successfully!")

