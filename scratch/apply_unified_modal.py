import re

path = 'zkc/merchant/products.html'

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. New Modal HTML
new_modal_html = """<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- UNIFIED EDIT PRODUCT & PRODUCT DETAILS POPUP MODAL             -->
<!-- Exactly matching Store Builder CMS + Smeram Inclusive GST      -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="modal-overlay" id="editProductModal" onclick="handleBackdropClick(event)">
  <div class="modal-card" onclick="event.stopPropagation()">
    
    <!-- Modal Header -->
    <div class="modal-header">
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">✏️</span>
          <h2 style="font-family:var(--font-display);font-size:18px;font-weight:800;margin:0" id="productModalTitle">Edit Product and Product details</h2>
          <span class="badge badge-green" id="modal-status-badge">Active</span>
        </div>
        <div style="font-size:12px;color:var(--zk-muted);margin-top:4px">
          Customize pricing, stock quantity, sizes/variants, ingredients, enlarged description, and optional customer highlights.
        </div>
      </div>
      <button onclick="closeEditModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--zk-muted);padding:4px 8px;border-radius:6px">✕</button>
    </div>

    <!-- Modal Form Body -->
    <div class="modal-body">
      <input type="hidden" id="edit-prod-id">

      <!-- Section 1: Basic Information -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>📦 Basic Information</span>
          <span style="font-size:11px;font-weight:600;color:var(--zk-dim)">* Required fields</span>
        </div>

        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label">Product Name *</label>
          <input type="text" class="field" id="modal-pname" placeholder="e.g. Smeram Siddha Ortho Pain Relief Thailam" style="font-weight:700;font-size:14px">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="field-group">
            <label class="field-label">SKU</label>
            <input type="text" class="field" id="modal-psku" placeholder="e.g. SM-PO-100" style="font-family:monospace;font-weight:600">
          </div>
          <div class="field-group">
            <label class="field-label">Category</label>
            <select class="field" id="modal-pcat">
              <option value="Joint Care &amp; Pain Relief">Joint Care &amp; Pain Relief</option>
              <option value="Hair Care">Hair Care</option>
              <option value="Skin Care &amp; Face Pack">Skin Care &amp; Face Pack</option>
              <option value="Vedic Health Foods">Vedic Health Foods</option>
              <option value="Natural &amp; Herbal">Natural &amp; Herbal</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Brand</label>
            <input type="text" class="field" id="modal-pbrand" placeholder="e.g. Smeram Naturals" value="Smeram Naturals">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group">
            <label class="field-label">Product Size / Pack</label>
            <input type="text" class="field" id="modal-psize" placeholder="e.g. 100 ml / 200 ml / 500 g">
          </div>
          <div class="field-group">
            <label class="field-label">Net Quantity</label>
            <div style="display:flex;gap:8px">
              <input type="number" class="field" id="modal-pnet-value" placeholder="100" step="0.01" style="flex:1">
              <select class="field" id="modal-pnet-unit" style="width:90px">
                <option value="">—</option>
                <option value="ml">ml</option>
                <option value="l">L</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Pricing, Stock & Inclusive GST -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>💰 Pricing, Stock &amp; Inclusive GST</span>
          <span class="badge badge-green" style="font-size:11px">Smeram Industries Inclusive GST</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-group">
            <label class="field-label">Selling Price (Gross ₹) *</label>
            <input type="number" class="field" id="modal-pprice" placeholder="349" style="font-weight:700" oninput="updateModalGstBreakdown()">
            <div style="font-size:11px;color:var(--zk-muted);margin-top:2px">Inclusive of all taxes</div>
          </div>
          <div class="field-group">
            <label class="field-label">Compare price / MRP (₹)</label>
            <input type="number" class="field" id="modal-pmrp" placeholder="499">
          </div>
          <div class="field-group">
            <label class="field-label" style="display:flex;justify-content:space-between">
              <span>Stock Quantity (Units) *</span>
              <span id="modal-stock-lock-badge" style="display:none;font-size:10px;color:#2563eb;font-weight:700">🔒 Sum of sizes</span>
            </label>
            <input type="number" class="field" id="modal-pstock" placeholder="120" style="font-weight:800;color:#0f172a" min="0">
            <div style="font-size:11px;color:var(--zk-muted);margin-top:2px" id="modal-stock-help">Master available inventory units</div>
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
            <input type="text" class="field" id="modal-phsn" placeholder="30049013" style="font-weight:600;font-family:monospace">
            <div style="font-size:11px;color:var(--zk-muted);margin-top:2px">e.g. 30049013 / 33059019</div>
          </div>
          <div class="field-group">
            <label class="field-label">Low-Stock Alert Level</label>
            <input type="number" class="field" id="modal-plow-stock" placeholder="Store default (20)" min="0">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group">
            <label class="field-label">Availability</label>
            <select class="field" id="modal-pinstock">
              <option value="true">In stock</option>
              <option value="false">Sold out</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Visibility Status</label>
            <select class="field" id="modal-pstatus">
              <option value="published">Published (Active on Store)</option>
              <option value="hidden">Hidden (Link only - not listed, still sells)</option>
              <option value="draft">Draft (Hidden)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <!-- Live Inclusive GST Breakdown Card -->
        <div id="modal-gst-calc-box" style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:14px 16px;margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:12.5px;font-weight:800;color:#166534;display:flex;align-items:center;gap:6px">
              <span>🧾</span>
              <span>Inclusive GST Breakdown Preview (Smeram Industries)</span>
            </div>
            <span class="badge badge-green" id="modal-calc-rate-badge" style="font-weight:800">5% GST</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;font-size:12px;background:#fff;padding:10px 14px;border-radius:8px;border:1px solid #BBF7D0">
            <div>
              <div style="color:#64748B;font-size:11px;margin-bottom:2px">Selling Price (Gross)</div>
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

      </div>

      <!-- Section 3: Sizes / Variants (Each with its own Price, MRP, SKU and Stock Quantity) -->
      <div class="modal-section" style="background:#F8FAFC;border:1.5px solid #CBD5E1">
        <div class="modal-sec-title">
          <div>
            <span>📏 Sizes &amp; Variants</span>
            <span style="font-size:12px;font-weight:400;color:var(--zk-muted);margin-left:6px">(e.g. 100 ml, 200 ml — each with its own Price, MRP, SKU &amp; Stock)</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addModalVariantRow()" style="font-weight:700">＋ Add size</button>
        </div>

        <div id="modalVariantRows">
          <!-- Populated by JS -->
        </div>
        <div id="modalVariantHint" style="font-size:12px;color:#64748b;margin-top:8px;font-weight:500">
          No sizes: the price and stock above are used.
        </div>
      </div>

      <!-- Section 4: Marketing & Storefront Badges -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>🏷️ Marketing &amp; Storefront Highlights</span>
          <span class="badge badge-amber" style="font-size:11px">High Conversion Badges</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-group">
            <label class="field-label">Special Offer Tag</label>
            <input type="text" class="field" id="modal-poffer-text" placeholder="e.g. Special Festive Offer - Save ₹150">
          </div>
          <div class="field-group">
            <label class="field-label">Offer / Discount Display</label>
            <select class="field" id="modal-pshow-offer">
              <option value="">Use store default setting</option>
              <option value="show">Show for this product</option>
              <option value="hide">Hide for this product</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Badge / Method Banner</label>
          <input type="text" class="field" id="modal-pbadge-text" placeholder="e.g. Classical Siddha Tailam · 24 Medicinal Herbs · Cold Pressed">
          <div style="font-size:11px;color:var(--zk-muted);margin-top:2px">Displays as an authentic trust banner right under the product title on your store.</div>
        </div>
      </div>

      <!-- Section 5: Description & Ingredients -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>📝 Product Description &amp; Formulation</span>
          <span style="font-size:11px;color:var(--zk-muted)">Expanded writing area</span>
        </div>

        <div class="field-group" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <label class="field-label" style="margin-bottom:0">Product Description *</label>
            <span style="font-size:11px;color:var(--zk-muted)">Start lines with (<code>- </code>) for bullet highlights</span>
          </div>
          <textarea class="desc-textarea" id="modal-pdesc" placeholder="Comprehensive product description..."></textarea>
          <div style="font-size:11px;color:#64748b;margin-top:4px">
            💡 <strong>Formatting tip:</strong> Start lines with a hyphen (<code>- </code>) to generate stylish checkmark bullet points on your store. Follow with regular paragraphs for background &amp; formulation.
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">🌿 Key Ingredients / Formulation</label>
          <textarea class="field" id="modal-pingredients" rows="3" style="width:100%;resize:vertical;font-size:13px;line-height:1.5" placeholder="Mahanarayan Thailam, Wintergreen Oil, Camphor, Nilgiri (Eucalyptus), Pudina Satva, Gandhapura, Til Oil (Sesame)..."></textarea>
          <div style="font-size:11px;color:var(--zk-muted);margin-top:2px">Comma separated list of key botanical herbs, oils, or active ingredients.</div>
        </div>
      </div>

      <!-- Section 6: Additional Parameters (Optional Check Fields) -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>✨ Additional Parameters (Optional Check Fields)</span>
          <span class="badge badge-green" style="font-size:11px">Modular Tabs</span>
        </div>

        <!-- 1. Additional Note (Inclusive of GST and free shipping) -->
        <div class="param-box">
          <label class="param-label">
            <input type="checkbox" id="modal-chk-note" checked onchange="toggleModalParam('note')">
            <span>🏷️ Additional Note (e.g. Inclusive of GST and free shipping.)</span>
          </label>
          <div id="modal-box-note">
            <input type="text" class="field" id="modal-pnote" value="Inclusive of GST and free shipping." placeholder="e.g. Inclusive of GST and free shipping.">
            <div class="trust-badge-preview" id="modal-note-preview">
              <span>🚚</span>
              <span id="modal-note-preview-text">Inclusive of GST and free shipping.</span>
            </div>
            <div style="font-size:11px;color:var(--zk-muted);margin-top:4px">Renders as a trust badge right below the price on your storefront.</div>
          </div>
        </div>

        <!-- 2. User Instructions -->
        <div class="param-box">
          <label class="param-label">
            <input type="checkbox" id="modal-chk-instructions" onchange="toggleModalParam('instructions')">
            <span>📋 User Instructions (How to apply / consume / use)</span>
          </label>
          <div id="modal-box-instructions" style="display:none">
            <textarea class="param-textarea" id="modal-pinstructions" placeholder="e.g. Apply 5-10 ml gently over affected joints or muscles. Massage in circular motions for 5 minutes. Leave on or apply a warm compress for enhanced relief."></textarea>
            <div style="font-size:11px;color:var(--zk-muted);margin-top:4px">Appears under the dedicated 'How to Use / Instructions' tab on your product details page.</div>
          </div>
        </div>

        <!-- 3. Benefits -->
        <div class="param-box">
          <label class="param-label">
            <input type="checkbox" id="modal-chk-benefits" onchange="toggleModalParam('benefits')">
            <span>⭐ Key Benefits / Bullet Highlights</span>
          </label>
          <div id="modal-box-benefits" style="display:none">
            <textarea class="param-textarea" id="modal-pbenefits" placeholder="e.g. • Instant cooling sensation followed by deep warming relief&#10;• Clinically proven to reduce joint stiffness and inflammation&#10;• 100% Classical Siddha herbal formulation (HSN 30049013 - 5% GST)"></textarea>
            <div style="font-size:11px;color:var(--zk-muted);margin-top:4px">Appears as featured bullet points in the 'Key Benefits' tab on the storefront.</div>
          </div>
        </div>

      </div>

      <!-- Section 7: Product Photos -->
      <div class="modal-section">
        <div class="modal-sec-title">
          <span>🖼️ Product Photos &amp; Media</span>
          <span style="font-size:11px;color:var(--zk-muted)">Up to 10 photos</span>
        </div>

        <div id="modalPhotoPreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"></div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;position:relative;overflow:hidden">
            📷 Upload Photos
            <input type="file" accept="image/*" multiple id="modalPhotoUpload" onchange="uploadModalPhotos(this)" style="position:absolute;left:0;top:0;opacity:0;cursor:pointer;width:100%;height:100%">
          </label>
          <span style="font-size:11.5px;color:var(--zk-muted)">Or paste image URLs below (one per line):</span>
        </div>
        <textarea class="field" id="modal-pimages" rows="3" placeholder="https://... /assets/..." style="width:100%;font-size:12px;font-family:monospace" oninput="renderModalPhotoThumbnails()"></textarea>
      </div>

    </div>

    <!-- Modal Footer -->
    <div class="modal-footer">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-secondary btn-sm" onclick="closeEditModal()">Cancel</button>
        <a id="modal-full-edit-link" href="#" class="btn btn-ghost btn-sm" style="color:var(--zk-indigo)">Open full-page editor ↗</a>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary btn-sm" id="modal-save-btn" onclick="saveProductFromModal()" style="font-size:13px;padding:9px 24px">💾 Save Changes</button>
      </div>
    </div>

  </div>
</div>"""

# Replace modal in html
m_start = html.find('<!-- REDESIGNED EDIT PRODUCT & PRODUCT DETAILS POPUP MODAL')
if m_start == -1:
    m_start = html.find('<div class="modal-overlay" id="editProductModal"')
m_end = html.find('<!-- ═══════════════════════════════════════════════════════════════ -->', m_start + 10)
if m_end == -1:
    m_end = html.find('<script src="../assets/js/app.js">')

html = html[:m_start] + new_modal_html + "\n\n" + html[m_end:]

# 2. Update PRODUCTS_LIST with complete data for all 4 products
new_catalog = """var PRODUCTS_LIST = [
  {
    id: 1,
    name: "Smeram Siddha Ortho Pain Relief Thailam (Joint Care)",
    sku: "SM-PO-100",
    hsn_code: "30049013",
    price: 349,
    mrp: 499,
    compare_price: 499,
    gst_rate: 5,
    quantity: 120,
    stock: 120,
    product_size: "100 ml",
    net_quantity_value: 100,
    net_quantity_unit: "ml",
    low_stock_threshold: 20,
    in_stock: true,
    category_name: "Joint Care & Pain Relief",
    brand: "Smeram Naturals",
    status: "published",
    badge_text: "Classical Siddha Tailam · 24 Medicinal Herbs",
    offer_text: "Festive Launch Offer - Save ₹150",
    show_offer: "show",
    ingredients: "Mahanarayan Thailam, Wintergreen Oil, Camphor, Nilgiri (Eucalyptus), Pudina Satva, Gandhapura, Til Oil (Sesame)",
    variants: [
      { id: "v1", label: "100 ml", size_value: 100, size_unit: "ml", price: 349, compare_price: 499, sku: "SM-PO-100", quantity: 70 },
      { id: "v2", label: "200 ml", size_value: 200, size_unit: "ml", price: 599, compare_price: 899, sku: "SM-PO-200", quantity: 50 }
    ],
    images: ["/assets/themes/smeram/pain-oil.png"],
    created_at: new Date().toISOString(),
    description: "- Classical Siddha Formulation for Joint & Muscle Pain\\n- Rapid Deep Tissue Penetration & Warming Relief\\n- Clinically Proven to Alleviate Stiffness & Spasms\\n- 100% Herbal, Non-Greasy & Fast Absorbing\\n\\nTraditional Siddha herbal pain relief thailam formulated with 24 potent anti-inflammatory botanicals, Mahanarayan thailam, wintergreen, and camphor. Rapid deep tissue penetration for arthritic knee pain, joint stiffness, muscular spasms, and backache.",
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
    compare_price: 449,
    gst_rate: 5,
    quantity: 85,
    stock: 85,
    product_size: "200 ml",
    net_quantity_value: 200,
    net_quantity_unit: "ml",
    low_stock_threshold: 25,
    in_stock: true,
    category_name: "Hair Care",
    brand: "Smeram Naturals",
    status: "published",
    badge_text: "Sneha - Kalka - Drava Method · Cold Pressed",
    offer_text: "Special Festive Offer - Save ₹150",
    show_offer: "show",
    ingredients: "Cold pressed Virgin Coconut Oil, Bhringraj, Brahmi, Amla, Hibiscus, Fenugreek, Vetiver, Curry Leaves, Jadamanshi",
    variants: [
      { id: "v3", label: "100 ml", size_value: 100, size_unit: "ml", price: 199, compare_price: 299, sku: "SM-HO-100", quantity: 35 },
      { id: "v4", label: "200 ml", size_value: 200, size_unit: "ml", price: 299, compare_price: 449, sku: "SM-HO-200", quantity: 50 }
    ],
    images: ["/assets/themes/smeram/hair-oil.png"],
    created_at: new Date(Date.now() - 86400000*2).toISOString(),
    description: "- Double Boiled & Double Infused over 72 Hours\\n- Hair Growth Promoter from Deep Roots\\n- 100% Dandruff Control & Scalp Cooling\\n- 100% Natural, Vegan & Cruelty-Free\\n\\nSmeram 100% Natural Herbal Hair Oil is deeply infused with 18 vital ayurvedic herbs including Bhringraj, Amla, Brahmi, Hibiscus, Fenugreek, and cold-pressed Virgin Coconut Oil. Prepared using traditional slow-heat extraction to retain potent phytochemicals that nourish hair follicles, reduce hair thinning, and restore natural shine and density.",
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
    compare_price: 699,
    gst_rate: 18,
    quantity: 65,
    stock: 65,
    product_size: "30 ml",
    net_quantity_value: 30,
    net_quantity_unit: "ml",
    low_stock_threshold: 15,
    in_stock: true,
    category_name: "Skin Care & Face Pack",
    brand: "Smeram Naturals",
    status: "published",
    badge_text: "Pure Kashmiri Saffron · Ayurvedic Radiance",
    offer_text: "Limited Edition Glow Pack",
    show_offer: "show",
    ingredients: "Kashmiri Saffron (Kumkuma), Red Sandalwood, Manjistha, Yashtimadhu, Goat Milk, Sesame Oil",
    variants: [
      { id: "v5", label: "30 ml", size_value: 30, size_unit: "ml", price: 499, compare_price: 699, sku: "SM-FP-030", quantity: 40 },
      { id: "v6", label: "50 ml", size_value: 50, size_unit: "ml", price: 799, compare_price: 1199, sku: "SM-FP-050", quantity: 25 }
    ],
    images: ["/assets/themes/smeram/face-pack.png"],
    created_at: new Date(Date.now() - 86400000*5).toISOString(),
    description: "- Enriched with Pure Grade-1 Kashmiri Saffron\\n- Reduces Dark Spots, Blemishes & Hyper-Pigmentation\\n- Natural Complexion Illuminator for Bridal Glow\\n- Deep Hydration without Greasy Residue\\n\\nAuthentic Kashmiri Saffron, Red Sandalwood, Manjistha, and goat milk concoction. Illuminates complexion, lightens hyperpigmentation, smooths uneven skin tone, and provides a radiant Ayurvedic bridal glow.",
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
    compare_price: 999,
    gst_rate: 18,
    quantity: 50,
    stock: 50,
    product_size: "500 g",
    net_quantity_value: 500,
    net_quantity_unit: "g",
    low_stock_threshold: 10,
    in_stock: true,
    category_name: "Vedic Health Foods",
    brand: "Smeram Naturals",
    status: "published",
    badge_text: "Sprouted 24 Grains · Bilona Churned A2 Ghee",
    offer_text: "Wholesome Family Wellness Pack",
    show_offer: "show",
    ingredients: "Sprouted Ragi, Bajra, Jowar, Wheat, Green Gram, Almonds, Cashews, Cardamom, A2 Desi Gir Cow Ghee",
    variants: [
      { id: "v7", label: "500 g", size_value: 500, size_unit: "g", price: 799, compare_price: 999, sku: "SM-HM-500", quantity: 30 },
      { id: "v8", label: "1 kg", size_value: 1000, size_unit: "g", price: 1449, compare_price: 1899, sku: "SM-HM-1000", quantity: 20 }
    ],
    images: ["/assets/themes/smeram/health-mix.png"],
    created_at: new Date(Date.now() - 86400000*8).toISOString(),
    description: "- 24 Sprouted Grains, Millets, Pulses & Dry Fruits\\n- Paired with Traditional Bilona A2 Desi Gir Cow Ghee\\n- Complete Nutrition for Immunity, Stamina & Gut Health\\n- Zero Added Refined Sugar, 100% Preservative Free\\n\\nTraditional sprouted multi-millet, sprouted grains, nuts, and cardamom nutritious health mix paired with pure bilona churned A2 Vedic Desi Gir Cow Ghee. Provides complete sustained energy, gut nourishment, and immunity for children and adults.",
    user_instructions: "Mix 2 tablespoons of health mix with 200ml cold milk or water. Cook on low flame for 3-5 minutes stirring continuously. Add 1 teaspoon of A2 Desi Ghee and jaggery to taste.",
    benefits: "• Sprouted 24 nutritious grains, millets, pulses, and dry fruits\\n• High protein, dietary fiber, and natural calcium\\n• Wholesome dietary nourishment (HSN 19011099 - 18% GST)\\n• Zero added sugar, zero preservatives, 100% natural",
    additional_note: "Inclusive of 18% GST and free shipping."
  }
];"""

cat_start = html.find('var PRODUCTS_LIST = [')
cat_end = html.find('function renderProductsTable', cat_start)
html = html[:cat_start] + new_catalog + "\n\n" + html[cat_end:]

# 3. Add JS functions for Variants, Photos, Population, and Saving
new_js_methods = """
// ─── SIZES / VARIANTS EDITOR (MATCHING STORE BUILDER) ───────────
const VARIANT_UNITS = '<option value="">—</option><option value="ml">ml</option><option value="l">L</option><option value="g">g</option><option value="kg">kg</option><option value="pcs">pcs</option>';

function modalVariantRowHtml(v) {
  v = v || {};
  return '<div class="variant-row" data-id="' + (v.id || '') + '" style="display:grid;grid-template-columns:1.3fr .8fr .7fr .8fr .8fr 1fr .8fr auto;gap:6px;margin-bottom:6px;align-items:center;background:#fff;padding:8px 10px;border:1px solid #E2E8F0;border-radius:8px">'
    + '<input data-k="label" class="field" style="font-size:12px;padding:6px 8px" placeholder="Label e.g. 100 ml" value="' + (v.label || '') + '">'
    + '<input data-k="size_value" class="field" style="font-size:12px;padding:6px 8px" type="number" min="0" step="0.01" placeholder="Size" value="' + (v.size_value != null ? v.size_value : '') + '">'
    + '<select data-k="size_unit" class="field" style="font-size:12px;padding:6px 4px">' + VARIANT_UNITS.replace('value="' + (v.size_unit || '') + '"', 'value="' + (v.size_unit || '') + '" selected') + '</select>'
    + '<input data-k="price" class="field" style="font-size:12px;padding:6px 8px;font-weight:700" type="number" min="0" placeholder="Price ₹" value="' + (v.price != null ? v.price : '') + '">'
    + '<input data-k="compare_price" class="field" style="font-size:12px;padding:6px 8px" type="number" min="0" placeholder="MRP ₹" value="' + (v.compare_price != null ? v.compare_price : '') + '">'
    + '<input data-k="sku" class="field" style="font-size:12px;padding:6px 8px;font-family:monospace" placeholder="SKU" value="' + (v.sku || '') + '">'
    + '<input data-k="quantity" class="field" style="font-size:12px;padding:6px 8px;font-weight:800;color:#0F172A" type="number" min="0" placeholder="Stock" value="' + (v.quantity != null ? v.quantity : '') + '">'
    + '<button type="button" class="btn btn-secondary btn-sm" data-remove-variant title="Remove size" style="color:#DC2626;padding:4px 8px;font-weight:bold">✕</button></div>';
}

function renderModalVariantRows(list) {
  var host = document.getElementById('modalVariantRows');
  if (!host) return;
  host.innerHTML = (list || []).length
    ? '<div style="display:grid;grid-template-columns:1.3fr .8fr .7fr .8fr .8fr 1fr .8fr auto;gap:6px;font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px;padding:0 8px">'
      + '<span>Label / Size</span><span>Value</span><span>Unit</span><span>Selling Price ₹</span><span>MRP ₹</span><span>SKU</span><span>Stock Qty</span><span></span></div>'
      + list.map(modalVariantRowHtml).join('')
    : '';
  bindModalVariantRows();
}

function bindModalVariantRows() {
  var host = document.getElementById('modalVariantRows');
  if (!host) return;
  host.querySelectorAll('[data-remove-variant]').forEach(function(b) {
    b.onclick = function() {
      b.closest('.variant-row').remove();
      if (!host.querySelector('.variant-row')) host.innerHTML = '';
      updateModalVariantHint();
    };
  });
  host.querySelectorAll('.variant-row input, .variant-row select').forEach(function(el) {
    el.oninput = updateModalVariantHint;
  });
  updateModalVariantHint();
}

function addModalVariantRow() {
  var host = document.getElementById('modalVariantRows');
  var rows = [...host.querySelectorAll('.variant-row')].map(function(r) {
    return {
      id: r.dataset.id,
      label: r.querySelector('[data-k=label]').value,
      size_value: r.querySelector('[data-k=size_value]').value,
      size_unit: r.querySelector('[data-k=size_unit]').value,
      price: r.querySelector('[data-k=price]').value,
      compare_price: r.querySelector('[data-k=compare_price]').value,
      sku: r.querySelector('[data-k=sku]').value,
      quantity: r.querySelector('[data-k=quantity]').value
    };
  });
  rows.push({});
  renderModalVariantRows(rows);
}

function updateModalVariantHint() {
  var rows = [...document.querySelectorAll('#modalVariantRows .variant-row')];
  var hint = document.getElementById('modalVariantHint');
  var qty = document.getElementById('modal-pstock');
  var lockBadge = document.getElementById('modal-stock-lock-badge');
  var help = document.getElementById('modal-stock-help');

  if (!rows.length) {
    if (hint) hint.textContent = 'No sizes: the price and stock above are used.';
    if (qty) { qty.readOnly = false; qty.style.background = '#fff'; }
    if (lockBadge) lockBadge.style.display = 'none';
    if (help) help.textContent = 'Master available inventory units';
    return;
  }

  var total = rows.reduce(function(n, r) {
    return n + (Number(r.querySelector('[data-k=quantity]').value) || 0);
  }, 0);
  var prices = rows.map(function(r) { return Number(r.querySelector('[data-k=price]').value); }).filter(function(n) { return n > 0; });

  if (hint) {
    hint.textContent = rows.length + ' size(s) configured · total stock: ' + total + (prices.length ? ' · store shows from ₹' + Math.min(...prices) : '') + '. Master stock automatically follows the sum of all sizes.';
  }
  if (qty) {
    qty.value = total;
    qty.readOnly = true;
    qty.style.background = '#f1f5f9';
  }
  if (lockBadge) lockBadge.style.display = 'inline-block';
  if (help) help.textContent = 'Locked: Calculated automatically from the ' + rows.length + ' variant sizes below.';
}

function collectModalVariantRows() {
  var rows = [...document.querySelectorAll('#modalVariantRows .variant-row')];
  var out = [];
  for (var r of rows) {
    var g = function(k) { return r.querySelector('[data-k=' + k + ']').value.trim(); };
    var row = {
      id: r.dataset.id || undefined,
      label: g('label'),
      size_value: g('size_value') === '' ? null : Number(g('size_value')),
      size_unit: g('size_unit') || null,
      price: g('price') === '' ? null : Number(g('price')),
      compare_price: g('compare_price') === '' ? null : Number(g('compare_price')),
      sku: g('sku') || null,
      quantity: g('quantity') === '' ? 0 : Number(g('quantity'))
    };
    if (!row.label && !row.size_value && row.price === null) continue;
    if (row.price === null) {
      toast.error('Enter a price for each size');
      return null;
    }
    out.push(row);
  }
  return out;
}

// ─── PHOTO PREVIEWS & UPLOADS ────────────────────────────────────
function modalPhotoList() {
  var val = document.getElementById('modal-pimages').value || '';
  return val.split(/\\n/).map(function(x) { return x.trim(); }).filter(Boolean);
}

function renderModalPhotoThumbnails() {
  var host = document.getElementById('modalPhotoPreview');
  if (!host) return;
  var photos = modalPhotoList();
  host.innerHTML = photos.map(function(u, i) {
    return '<span style="position:relative;display:inline-block">'
      + '<img src="' + u + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #CBD5E1">'
      + '<button type="button" onclick="removeModalPhoto(' + i + ')" title="Remove" style="position:absolute;top:-6px;right:-6px;border:0;border-radius:50%;width:20px;height:20px;background:#DC2626;color:#fff;cursor:pointer;font-size:12px;font-weight:bold;line-height:1">×</button>'
      + '</span>';
  }).join('');
}

function removeModalPhoto(idx) {
  var list = modalPhotoList();
  list.splice(idx, 1);
  document.getElementById('modal-pimages').value = list.join('\\n');
  renderModalPhotoThumbnails();
}

function uploadModalPhotos(input) {
  var files = Array.from(input.files || []).slice(0, 10);
  if (!files.length) return;
  var cur = modalPhotoList();
  for (var f of files) {
    cur.push('/assets/themes/smeram/' + f.name);
  }
  document.getElementById('modal-pimages').value = cur.join('\\n');
  renderModalPhotoThumbnails();
  toast.success(files.length + ' photo(s) added');
  input.value = '';
}

// ─── OPEN EDIT MODAL (COMPLETE STORE BUILDER + GST SYNC) ─────────
function openEditModal(prodId) {
  var p = PRODUCTS_LIST.find(function(item){ return item.id === prodId; });
  if (!p) {
    toast.error('Product not found');
    return;
  }

  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('productModalTitle').textContent = 'Edit Product and Product details';

  // Section 1: Basic info
  document.getElementById('modal-pname').value       = p.name || '';
  document.getElementById('modal-psku').value        = p.sku || ('SM-0' + p.id);
  document.getElementById('modal-pcat').value        = p.category_name || 'Joint Care & Pain Relief';
  document.getElementById('modal-pbrand').value      = p.brand || 'Smeram Naturals';
  document.getElementById('modal-psize').value       = p.product_size || p.size || '';
  document.getElementById('modal-pnet-value').value  = p.net_quantity_value != null ? p.net_quantity_value : '';
  document.getElementById('modal-pnet-unit').value   = p.net_quantity_unit || 'ml';

  // Section 2: Pricing, Stock & GST
  document.getElementById('modal-pprice').value      = p.price || '';
  document.getElementById('modal-pmrp').value        = (p.compare_price != null ? p.compare_price : (p.mrp != null ? p.mrp : ''));
  var stockVal = (p.quantity !== undefined && p.quantity !== null) ? p.quantity : (p.stock !== undefined ? p.stock : 100);
  document.getElementById('modal-pstock').value      = stockVal;
  document.getElementById('modal-plow-stock').value  = p.low_stock_threshold != null ? p.low_stock_threshold : 20;

  var rate = (p.gst_rate !== undefined && p.gst_rate !== null) ? p.gst_rate : 5;
  document.getElementById('modal-pgrate').value      = rate;
  document.getElementById('modal-phsn').value        = p.hsn_code || (rate == 5 ? '30049013' : '33049990');
  document.getElementById('modal-pinstock').value    = String(p.in_stock !== false);
  document.getElementById('modal-pstatus').value    = p.status || (p.active !== false ? 'published' : 'draft');
  document.getElementById('modal-status-badge').textContent = (p.status === 'published' || p.active !== false ? 'Active' : 'Draft');

  // Section 3: Sizes & Variants
  renderModalVariantRows(p.variants || []);

  // Section 4: Marketing & Badges
  document.getElementById('modal-poffer-text').value  = p.offer_text || p.offer || '';
  document.getElementById('modal-pshow-offer').value  = p.show_offer === true ? 'show' : p.show_offer === false ? 'hide' : (p.show_offer || '');
  document.getElementById('modal-pbadge-text').value  = p.badge_text || '';

  // Section 5: Description & Ingredients
  document.getElementById('modal-pdesc').value        = p.description || '';
  document.getElementById('modal-pingredients').value = p.ingredients || '';

  // Section 6: Additional Parameters
  var chkNote = document.getElementById('modal-chk-note');
  var noteVal = (p.additional_note !== undefined && p.additional_note !== null) ? p.additional_note : 'Inclusive of GST and free shipping.';
  document.getElementById('modal-pnote').value = noteVal;
  document.getElementById('modal-note-preview-text').textContent = noteVal || 'Inclusive of GST and free shipping.';
  chkNote.checked = (p.additional_note !== null && p.additional_note !== '');
  toggleModalParam('note');

  var chkInst = document.getElementById('modal-chk-instructions');
  document.getElementById('modal-pinstructions').value = p.user_instructions || '';
  chkInst.checked = !!(p.user_instructions && p.user_instructions.trim());
  toggleModalParam('instructions');

  var chkBen = document.getElementById('modal-chk-benefits');
  document.getElementById('modal-pbenefits').value = p.benefits || '';
  chkBen.checked = !!(p.benefits && p.benefits.trim());
  toggleModalParam('benefits');

  // Section 7: Photos
  var imgs = p.images || [];
  document.getElementById('modal-pimages').value = Array.isArray(imgs) ? imgs.join('\\n') : imgs;
  renderModalPhotoThumbnails();

  // Full page edit link
  document.getElementById('modal-full-edit-link').href = 'products-add.html?id=' + p.id;

  // Live GST breakdown update
  updateModalGstBreakdown();

  // Open modal
  var modal = document.getElementById('editProductModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ─── SAVE PRODUCT FROM MODAL (STORE BUILDER & API COMPATIBLE) ───
async function saveProductFromModal() {
  var id = parseInt(document.getElementById('edit-prod-id').value);
  var p  = PRODUCTS_LIST.find(function(item){ return item.id === id; });
  if (!p) { toast.error('Product not found'); return; }

  var name  = document.getElementById('modal-pname').value.trim();
  var sku   = document.getElementById('modal-psku').value.trim();
  var cat   = document.getElementById('modal-pcat').value;
  var brand = document.getElementById('modal-pbrand').value.trim();
  var size  = document.getElementById('modal-psize').value.trim();
  var netVal= document.getElementById('modal-pnet-value').value ? parseFloat(document.getElementById('modal-pnet-value').value) : null;
  var netUnit= document.getElementById('modal-pnet-unit').value;

  var price = parseFloat(document.getElementById('modal-pprice').value);
  var mrp   = parseFloat(document.getElementById('modal-pmrp').value) || null;
  var stock = parseInt(document.getElementById('modal-pstock').value) || 0;
  var lowStk= parseInt(document.getElementById('modal-plow-stock').value) || 20;
  var inStk = document.getElementById('modal-pinstock').value === 'true';

  var gstRate = parseFloat(document.getElementById('modal-pgrate').value) || 5;
  var hsnCode = document.getElementById('modal-phsn').value.trim() || (gstRate == 5 ? '30049013' : '33049990');
  var status= document.getElementById('modal-pstatus').value;

  var variantPayload = collectModalVariantRows();
  if (variantPayload === null) return;

  var offerText = document.getElementById('modal-poffer-text').value.trim();
  var showOffer = document.getElementById('modal-pshow-offer').value;
  var badgeText = document.getElementById('modal-pbadge-text').value.trim();

  var desc  = document.getElementById('modal-pdesc').value.trim();
  var ingr  = document.getElementById('modal-pingredients').value.trim();

  var chkNote = document.getElementById('modal-chk-note').checked;
  var chkInst = document.getElementById('modal-chk-instructions').checked;
  var chkBen  = document.getElementById('modal-chk-benefits').checked;

  var noteVal = chkNote ? (document.getElementById('modal-pnote').value.trim() || 'Inclusive of GST and free shipping.') : null;
  var instVal = chkInst ? document.getElementById('modal-pinstructions').value.trim() : null;
  var benVal  = chkBen  ? document.getElementById('modal-pbenefits').value.trim() : null;

  var images = modalPhotoList();

  if (!name) { toast.error('Product name is required'); return; }
  if (isNaN(price) || price <= 0) { toast.error('Valid price is required'); return; }

  var btn = document.getElementById('modal-save-btn');
  btnLoading(btn, true);

  // If variants configured, sum their stock
  if (variantPayload.length) {
    stock = variantPayload.reduce(function(acc, row){ return acc + (row.quantity || 0); }, 0);
  }

  var payload = {
    name: name,
    sku: sku,
    category_name: cat,
    brand: brand,
    product_size: size,
    net_quantity_value: netVal,
    net_quantity_unit: netUnit,
    price: price,
    mrp: mrp,
    compare_price: mrp,
    stock: stock,
    quantity: stock,
    low_stock_threshold: lowStk,
    in_stock: inStk,
    gst_rate: gstRate,
    hsn_code: hsnCode,
    status: status,
    active: status !== 'draft',
    variants: variantPayload,
    offer_text: offerText,
    show_offer: showOffer,
    badge_text: badgeText,
    description: desc,
    ingredients: ingr,
    additional_note: noteVal,
    user_instructions: instVal,
    benefits: benVal,
    images: images
  };

  // Try API update if token exists
  var token = auth.token;
  if (token && !token.startsWith('demo_token')) {
    try {
      var r = await fetch(API_BASE + '/products/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
      });
      var data = await r.json();
      if (data.product) {
        Object.assign(p, data.product);
      }
    } catch(e) { console.warn('API update failed, saving locally:', e); }
  }

  // Update in-memory object
  Object.assign(p, payload);

  btnLoading(btn, false);
  closeEditModal();
  renderProductsTable(PRODUCTS_LIST);
  toast.success('Product "' + name + '" and details saved successfully!');
}
"""

# Replace the old JS methods block
js_start = html.find('// ─── MODAL OPEN / POPULATE / CLOSE')
js_end = html.find('// Search and Category Filter')

if js_start != -1 and js_end != -1:
    html = html[:js_start] + new_js_methods + "\n\n" + html[js_end:]
    print("Replaced JS modal methods successfully!")
else:
    print("Could not find JS anchors:", js_start, js_end)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated products.html with unified modal!")

