const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'zkc', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc', 'clients', 'smeram', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'clients', 'smeram', 'merchant', 'index.html')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  // 1. Add "Shop Display" to the sidebar menu after "Theme & design" if not already present
  if (!content.includes('data-view="display"')) {
    const themeBtn = '<button class="nav-item" data-view="theme"><span class="nav-icon">🎨</span><span>Theme &amp; design</span></button>';
    const displayBtn = '<button class="nav-item" data-view="theme"><span class="nav-icon">🎨</span><span>Theme &amp; design</span></button>\n      <button class="nav-item" data-view="display"><span class="nav-icon">👁️</span><span>Shop Display</span></button>';
    content = content.replace(themeBtn, displayBtn);
  }

  // 2. Extract Shop Display into its own top-level section: view-display
  const oldShopDisplayCard = `        <div class="card">
          <h3 style="font-size:15px;margin-bottom:4px">Shop display</h3>
          <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Applies to the live store straight away. Each product can override the offer setting in the Store Builder product details.</p>
          <div style="display:grid;gap:10px;max-width:680px">
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsAnnouncement"><span><b>Show Announcement Bar</b><br><small style="color:var(--muted)">Display top notification banner (promotions, announcements) across the storefront.</small></span></label>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsShowCategoryImages" checked><span><b>Show category images in Shop menu</b><br><small style="color:var(--muted)">Display thumbnail photos beside each category in the header Shop dropdown subcategories list.</small></span></label>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsShowOffers"><span><b>Show offers &amp; discounts</b><br><small style="color:var(--muted)">MRP strike-through, “% OFF” badges and offer tags such as “Special Introductory Offer”.</small></span></label>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsAllProducts"><span><b>Show the “All Products” section</b><br><small style="color:var(--muted)">The product grid on the home page and its menu, tab and footer links. Other sections are switched in Store Builder → Settings.</small></span></label>
            <div class="legal-card" style="display:block">
              <b>Home page category boxes</b><br><small style="color:var(--muted)">Where shoppers land when they click a category box on the home page. When a category has 1 product, opens View Details directly so customers can buy immediately.</small>
              <div class="form-grid" style="margin:10px 0 0">
                <div class="form-group"><label for="dsCategoryLink">Opens</label>
                  <select id="dsCategoryLink">
                    <option value="single_product">Product page when the category has only 1 product (Recommended)</option>
                    <option value="collection">Category page (list of products)</option>
                    <option value="first_product">Always the first product's page</option>
                  </select>
                </div>
                <div class="form-group"><label for="dsCategoryCta">Box button text</label><input id="dsCategoryCta" maxlength="40" placeholder="View Details (default when 1 product) / Explore Products"></div>
              </div>
            </div>
            <div class="legal-card" style="display:block">
              <b>Product details page sections ("View Details")</b><br><small style="color:var(--muted)">Configure what information is displayed on the product details page and quick-view modal.</small>
              <div style="display:grid;gap:8px;margin-top:10px">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="dsShowBenefits" checked><span><b>Show Key Benefits</b> (clinical and therapeutic benefit highlights)</span></label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="dsShowInstructions" checked><span><b>Show How to Use / Instructions</b> (step-by-step directions)</span></label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="dsShowIngredients" checked><span><b>Show Ingredients</b> (active botanical ingredients breakdown)</span></label>
              </div>
            </div>
          </div>
          <div id="dsStatus" style="font-size:13px;font-weight:600;margin:12px 0;min-height:18px"></div>
          <button class="btn-primary" id="btnSaveDisplay">Save display settings</button>
        </div>`;

  const newCheckoutBanner = `        <div class="card" style="background:#f8fafc;border:1px dashed #cbd5e1;padding:14px 20px;margin-top:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <b style="font-size:13px;color:#334155">Looking for Category Boxes or Product Details Sections?</b>
              <p style="font-size:12px;color:var(--muted);margin:2px 0 0">Configure Home page category boxes, Announcement Bar, Key Benefits, and How to Use in the dedicated <b>Shop Display</b> tab.</p>
            </div>
            <button type="button" class="btn-outline btn-sm" onclick="switchView('display')" style="font-weight:700">👁️ Go to Shop Display →</button>
          </div>
        </div>`;

  const newDedicatedView = `      <!-- VIEW: SHOP DISPLAY -->
      <section id="view-display" class="view-panel" style="display:none">
        <h1 class="page-title">Shop Display</h1>
        <p class="page-sub">Customize category boxes, announcement bar, product details sections, and storefront visibility options. Applies immediately to the live store.</p>
        <div class="card">
          <div style="display:grid;gap:14px;max-width:680px">
            <div class="legal-card" style="display:block;border-left:4px solid #ea580c;background:#fffaf5">
              <b style="font-size:14px;color:#9a3412">🏠 Home page category boxes</b><br>
              <small style="color:var(--muted)">Where shoppers land when they click a category box on the home page. When a category has 1 product, opens View Details directly so customers can buy immediately.</small>
              <div class="form-grid" style="margin:12px 0 0">
                <div class="form-group"><label for="dsCategoryLink">Opens</label>
                  <select id="dsCategoryLink">
                    <option value="single_product">Product page when the category has only 1 product (Recommended)</option>
                    <option value="collection">Category page (list of products)</option>
                    <option value="first_product">Always the first product's page</option>
                  </select>
                </div>
                <div class="form-group"><label for="dsCategoryCta">Box button text</label><input id="dsCategoryCta" maxlength="40" placeholder="View Details (default when 1 product) / Explore Products"></div>
              </div>
            </div>
            
            <div class="legal-card" style="display:block;border-left:4px solid #059669;background:#f0fdf4">
              <b style="font-size:14px;color:#065f46">📑 Product details page sections ("View Details")</b><br>
              <small style="color:var(--muted)">Configure what information is displayed on the product details page and quick-view modal.</small>
              <div style="display:grid;gap:8px;margin-top:10px">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="dsShowBenefits" checked><span><b>Show Key Benefits</b> (clinical and therapeutic benefit highlights)</span></label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="dsShowInstructions" checked><span><b>Show How to Use / Instructions</b> (step-by-step directions)</span></label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="dsShowIngredients" checked><span><b>Show Ingredients</b> (active botanical ingredients breakdown)</span></label>
              </div>
            </div>

            <div style="font-size:12px;font-weight:700;color:var(--muted);margin-top:6px">Header &amp; Storefront Sections</div>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsAnnouncement"><span><b>Show Announcement Bar</b><br><small style="color:var(--muted)">Display top notification banner (promotions, announcements) across the storefront.</small></span></label>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsShowCategoryImages" checked><span><b>Show category images in Shop menu</b><br><small style="color:var(--muted)">Display thumbnail photos beside each category in the header Shop dropdown subcategories list.</small></span></label>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsShowOffers"><span><b>Show offers &amp; discounts</b><br><small style="color:var(--muted)">MRP strike-through, “% OFF” badges and offer tags such as “Special Introductory Offer”.</small></span></label>
            <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="dsAllProducts"><span><b>Show the “All Products” section</b><br><small style="color:var(--muted)">The product grid on the home page and its menu, tab and footer links. Other sections are switched in Store Builder → Settings.</small></span></label>
          </div>
          <div id="dsStatus" style="font-size:13px;font-weight:600;margin:12px 0;min-height:18px"></div>
          <button class="btn-primary" id="btnSaveDisplay">Save display settings</button>
        </div>
      </section>`;

  if (content.includes(oldShopDisplayCard)) {
    content = content.replace(oldShopDisplayCard, newCheckoutBanner);
    content = content.replace('      <!-- VIEW: DEPLOY & HOSTING -->', newDedicatedView + '\n\n      <!-- VIEW: DEPLOY & HOSTING -->');
  }

  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated:', file);
}

