import re

def update_merchant_index(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add CSS before </style>
    css_addition = """
    /* WhatsApp Template Tabs & Previews */
    .wa-tabs-bar {
      display: flex;
      gap: 6px;
      border-bottom: 2px solid #e2e8f0;
      margin: 18px 0 16px;
      overflow-x: auto;
      padding-bottom: 0;
    }
    .wa-tab-btn {
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #e2e8f0;
      border-bottom: none;
      background: #f8fafc;
      color: var(--muted);
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      transition: all 0.15s ease;
      position: relative;
      bottom: -2px;
    }
    .wa-tab-btn:hover {
      background: #f1f5f9;
      color: var(--ink);
    }
    .wa-tab-btn.active {
      background: #fff;
      color: #065f46;
      border-color: #cbd5e1;
      border-bottom: 2px solid #fff;
      font-weight: 700;
      box-shadow: 0 -2px 6px rgba(0,0,0,0.03);
    }
    .wa-tab-pane {
      background: #fff;
      padding: 4px 0;
    }
    .wa-preview-box {
      white-space: pre-wrap;
      background: #ecfdf5;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 12px 14px;
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #064e3b;
      min-height: 180px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .wa-tpl-textarea {
      width: 100%;
      font: 12.5px/1.45 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 8px;
      padding: 10px 12px;
      color: #1e293b !important;
      resize: none;
      cursor: default !important;
      user-select: all;
    }
  </style>"""

    if '.wa-tabs-bar' not in content:
        content = content.replace('  </style>', css_addition, 1)
        print(f"Added CSS to {filepath}")

    # 2. Replace the WhatsApp templates section
    # Find start and end of templates inside #view-whatsapp
    start_marker = '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">Fields — click to insert into the message you are editing</div>'
    end_marker = '<!-- Automatic sender (v4.6) -->'

    if start_marker in content and end_marker in content:
        idx1 = content.find(start_marker)
        idx2 = content.find(end_marker)

        new_html = """<!-- Available Variables Badges -->
          <div style="margin: 14px 0 6px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:12px;font-weight:700;color:var(--muted)">Available Template Variables:</div>
            <span class="badge" style="background:#f1f5f9;color:var(--muted);font-weight:600">Templates are standard verified &amp; non-editable</span>
          </div>
          <div id="waChips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px"></div>

          <!-- WhatsApp Order Messages Tab Navigation -->
          <div class="wa-tabs-bar" id="waTemplateTabs">
            <button type="button" class="wa-tab-btn active" data-tab="tab-wa-customer" onclick="setWaTab('tab-wa-customer')">
              ✉️ Message to the customer (order confirmation)
            </button>
            <button type="button" class="wa-tab-btn" data-tab="tab-wa-shipped" onclick="setWaTab('tab-wa-shipped')">
              🚚 Shipped update (to the customer)
            </button>
            <button type="button" class="wa-tab-btn" data-tab="tab-wa-delivered" onclick="setWaTab('tab-wa-delivered')">
              ✅ Delivered update (to the customer)
            </button>
            <button type="button" class="wa-tab-btn" data-tab="tab-wa-preview" onclick="setWaTab('tab-wa-preview')">
              👁️ Preview (sample order) — customer care
            </button>
            <button type="button" class="wa-tab-btn" data-tab="tab-wa-low" onclick="setWaTab('tab-wa-low')">
              ⚠️ Low-stock alert (to customer care)
            </button>
          </div>

          <!-- Tab Content Panes -->
          <!-- TAB 1: Customer Order Confirmation -->
          <div class="wa-tab-pane" id="tab-wa-customer">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div>
                <strong style="font-size:14px;color:var(--ink)">Message to the customer (order confirmation)</strong>
                <div style="font-size:12px;color:var(--muted)">Sent automatically or via one-click WhatsApp to the customer once an order is placed or paid.</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="badge" style="background:#e2e8f0;color:#334155;font-weight:700">🔒 Non-Editable</span>
                <button type="button" class="btn-outline btn-sm" onclick="copyWaText('waCustomerTpl', this)">📋 Copy Template</button>
              </div>
            </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 16px;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Template Format</label>
                <textarea id="waCustomerTpl" readonly rows="8" class="wa-tpl-textarea"></textarea>
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--brand);display:block;margin-bottom:4px">Live WhatsApp Preview (Sample Order)</label>
                <div id="waPreviewCustomer" class="wa-preview-box"></div>
              </div>
            </div>
          </div>

          <!-- TAB 2: Shipped Update -->
          <div class="wa-tab-pane" id="tab-wa-shipped" style="display:none">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div>
                <strong style="font-size:14px;color:var(--ink)">Shipped update (to the customer)</strong>
                <div style="font-size:12px;color:var(--muted)">Triggered when order status changes to "Shipped" or when dispatching via Ekart / Courier.</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="badge" style="background:#e2e8f0;color:#334155;font-weight:700">🔒 Non-Editable</span>
                <button type="button" class="btn-outline btn-sm" onclick="copyWaText('waShippedTpl', this)">📋 Copy Template</button>
              </div>
            </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 16px;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Template Format</label>
                <textarea id="waShippedTpl" readonly rows="7" class="wa-tpl-textarea"></textarea>
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--brand);display:block;margin-bottom:4px">Live WhatsApp Preview (Sample Shipment)</label>
                <div id="waPreviewShipped" class="wa-preview-box"></div>
              </div>
            </div>
          </div>

          <!-- TAB 3: Delivered Update -->
          <div class="wa-tab-pane" id="tab-wa-delivered" style="display:none">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div>
                <strong style="font-size:14px;color:var(--ink)">Delivered update (to the customer)</strong>
                <div style="font-size:12px;color:var(--muted)">Sent automatically or via one-click when package delivery is confirmed.</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="badge" style="background:#e2e8f0;color:#334155;font-weight:700">🔒 Non-Editable</span>
                <button type="button" class="btn-outline btn-sm" onclick="copyWaText('waDeliveredTpl', this)">📋 Copy Template</button>
              </div>
            </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 16px;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Template Format</label>
                <textarea id="waDeliveredTpl" readonly rows="7" class="wa-tpl-textarea"></textarea>
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--brand);display:block;margin-bottom:4px">Live WhatsApp Preview (Sample Delivery)</label>
                <div id="waPreviewDelivered" class="wa-preview-box"></div>
              </div>
            </div>
          </div>

          <!-- TAB 4: Customer Care Sample Order Preview -->
          <div class="wa-tab-pane" id="tab-wa-preview" style="display:none">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div>
                <strong style="font-size:14px;color:var(--ink)">Preview (sample order) — customer care</strong>
                <div style="font-size:12px;color:var(--muted)">Real preview of incoming order notification dispatched to customer care number (+91 75399 72026).</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="badge" style="background:#dcfce7;color:#166534;font-weight:700">✓ Customer Care Preview</span>
                <button type="button" class="btn-outline btn-sm" onclick="copyWaText('waPreviewCareLive', this)">📋 Copy Preview</button>
              </div>
            </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 16px;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Customer Care Order Template Format</label>
                <textarea id="waCareTpl" readonly rows="11" class="wa-tpl-textarea"></textarea>
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--brand);display:block;margin-bottom:4px">Live WhatsApp Preview (Customer Care Order Alert)</label>
                <div id="waPreviewCareLive" class="wa-preview-box"></div>
              </div>
            </div>
          </div>

          <!-- TAB 5: Low-Stock Alert -->
          <div class="wa-tab-pane" id="tab-wa-low" style="display:none">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div>
                <strong style="font-size:14px;color:var(--ink)">Low-stock alert (to customer care)</strong>
                <div style="font-size:12px;color:var(--muted)">Dispatched to store manager / care WhatsApp when any product variant inventory falls below threshold.</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="badge" style="background:#e2e8f0;color:#334155;font-weight:700">🔒 Non-Editable</span>
                <button type="button" class="btn-outline btn-sm" onclick="copyWaText('waLowTpl', this)">📋 Copy Template</button>
              </div>
            </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 16px;">
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Template Format</label>
                <textarea id="waLowTpl" readonly rows="7" class="wa-tpl-textarea"></textarea>
              </div>
              <div>
                <label style="font-size:11.5px;font-weight:700;color:var(--brand);display:block;margin-bottom:4px">Live WhatsApp Preview (Sample Alert)</label>
                <div id="waPreviewLow" class="wa-preview-box"></div>
              </div>
            </div>
          </div>

          <!-- Hidden legacy fallback elements to avoid any JS reference errors -->
          <div style="display:none">
            <span id="waPreviewWhich"></span>
            <pre id="waPreview"></pre>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9">
            <button class="btn-primary" id="btnSaveWa">Save WhatsApp settings</button>
            <span id="waStatus" style="font-size:13px;font-weight:600"></span>
          </div>
        </div>

        """

        content = content[:idx1] + new_html + content[idx2:]
        print(f"Updated HTML templates structure in {filepath}")

    # 3. Update JavaScript logic
    old_wa_js = """    function waRenderPreview() {
      const el = waLastFocus || document.getElementById('waCareTpl'), sample = waSample();
      document.getElementById('waPreviewWhich').textContent = ({ waCustomerTpl: 'customer', waLowTpl: 'low-stock alert', waShippedTpl: 'shipped update', waDeliveredTpl: 'delivered update' })[el.id] || 'customer care';
      document.getElementById('waPreview').textContent = el.value.replace(/\{([a-z_]+)\}/g, (m, k) => sample[k] !== undefined ? sample[k] : m);
    }"""

    new_wa_js = """    function setWaTab(tabId) {
      document.querySelectorAll('#waTemplateTabs .wa-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });
      document.querySelectorAll('.wa-tab-pane').forEach(pane => {
        pane.style.display = (pane.id === tabId) ? 'block' : 'none';
      });
    }

    function copyWaText(elemId, btn) {
      const el = document.getElementById(elemId);
      if (!el) return;
      const txt = (el.value !== undefined) ? el.value : el.textContent;
      navigator.clipboard.writeText(txt).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        btn.style.borderColor = '#16a34a';
        btn.style.color = '#16a34a';
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      });
    }

    function waRenderPreview() {
      const sample = waSample();
      const replaceVars = (tpl) => (tpl || '').replace(/\{([a-z_]+)\}/g, (m, k) => sample[k] !== undefined ? sample[k] : m);

      const custEl = document.getElementById('waCustomerTpl');
      const custPrev = document.getElementById('waPreviewCustomer');
      if (custEl && custPrev) custPrev.textContent = replaceVars(custEl.value);

      const shipEl = document.getElementById('waShippedTpl');
      const shipPrev = document.getElementById('waPreviewShipped');
      if (shipEl && shipPrev) shipPrev.textContent = replaceVars(shipEl.value);

      const delEl = document.getElementById('waDeliveredTpl');
      const delPrev = document.getElementById('waPreviewDelivered');
      if (delEl && delPrev) delPrev.textContent = replaceVars(delEl.value);

      const careEl = document.getElementById('waCareTpl');
      const carePrev = document.getElementById('waPreviewCareLive');
      if (careEl && carePrev) carePrev.textContent = replaceVars(careEl.value);

      const lowEl = document.getElementById('waLowTpl');
      const lowPrev = document.getElementById('waPreviewLow');
      if (lowEl && lowPrev) lowPrev.textContent = replaceVars(lowEl.value);

      const legPrev = document.getElementById('waPreview');
      if (legPrev && careEl) legPrev.textContent = replaceVars(careEl.value);
    }"""

    if old_wa_js in content:
        content = content.replace(old_wa_js, new_wa_js, 1)
        print(f"Updated waRenderPreview and tab helpers in {filepath}")

    # 4. Update chips handling in loadWhatsAppSettings
    old_chips = """        document.getElementById('waChips').innerHTML = d.placeholders.map(p => `<button type="button" class="btn-outline btn-sm" data-ph="${escAttr(p.key)}" title="${escAttr(p.label)}">{${escHtml(p.key)}}</button>`).join('');
        document.querySelectorAll('#waChips [data-ph]').forEach(b => b.onclick = () => {
          const el = waLastFocus || document.getElementById('waCareTpl'), tok = '{' + b.dataset.ph + '}', at = el.selectionStart ?? el.value.length;
          el.value = el.value.slice(0, at) + tok + el.value.slice(el.selectionEnd ?? at);
          el.focus(); el.selectionStart = el.selectionEnd = at + tok.length; waRenderPreview();
        });"""

    new_chips = """        document.getElementById('waChips').innerHTML = d.placeholders.map(p => `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-family:monospace;font-size:11.5px;padding:4px 8px;border-radius:6px" title="${escAttr(p.label)}">{${escHtml(p.key)}}</span>`).join('');"""

    if old_chips in content:
        content = content.replace(old_chips, new_chips, 1)
        print(f"Updated chips in {filepath}")

    # 5. Guard btnResetWa and inputs
    old_reset = "document.getElementById('btnResetWa').onclick = () => { if (!waDefaults) return; document.getElementById('waCareTpl').value = waDefaults.care_template; document.getElementById('waCustomerTpl').value = waDefaults.customer_template; document.getElementById('waLowTpl').value = waDefaults.low_stock_template || ''; document.getElementById('waShippedTpl').value = waDefaults.shipped_template || ''; document.getElementById('waDeliveredTpl').value = waDefaults.delivered_template || ''; waRenderPreview(); };"
    new_reset = "const btnR = document.getElementById('btnResetWa'); if (btnR) btnR.onclick = () => { if (!waDefaults) return; document.getElementById('waCareTpl').value = waDefaults.care_template; document.getElementById('waCustomerTpl').value = waDefaults.customer_template; document.getElementById('waLowTpl').value = waDefaults.low_stock_template || ''; document.getElementById('waShippedTpl').value = waDefaults.shipped_template || ''; document.getElementById('waDeliveredTpl').value = waDefaults.delivered_template || ''; waRenderPreview(); };"

    if old_reset in content:
        content = content.replace(old_reset, new_reset, 1)
        print(f"Guarded btnResetWa in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {filepath}")

if __name__ == '__main__':
    for path in ['zkc/merchant/index.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/index.html']:
        update_merchant_index(path)

