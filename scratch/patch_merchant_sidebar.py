import re

path = 'zkc/merchant/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update aside CSS
old_aside_css = '''    /* Sidebar */
    aside {
      width: 250px;
      background: var(--sidebar);
      color: #fff;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      border-right: 1px solid #1e2e48;
    }
    .brand {
      padding: 22px 20px;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #1a2a44;
    }
    .brand span { color: #5ea8ff; }
    .nav {
      padding: 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 8px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 0;
      background: transparent;
      width: 100%;
      text-align: left;
      transition: all 0.15s;
    }
    .nav-item:hover {
      background: var(--sidebar-hover);
      color: #fff;
    }
    .nav-item.active {
      background: var(--primary);
      color: #fff;
      font-weight: 600;
    }
    .nav-icon { width: 18px; text-align: center; }'''

new_aside_css = '''    /* Sidebar */
    aside {
      width: 260px;
      background: var(--sidebar);
      color: #fff;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      border-right: 1px solid #1e2e48;
      height: 100vh;
      position: sticky;
      top: 0;
    }
    .brand {
      padding: 18px 20px;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #1a2a44;
    }
    .brand span { color: #5ea8ff; }
    .nav-controls {
      padding: 8px 12px 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-toggle-all-btn {
      background: transparent;
      border: 1px solid #233554;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .nav-toggle-all-btn:hover {
      background: var(--sidebar-hover);
      color: #fff;
      border-color: #3b82f6;
    }
    .nav {
      padding: 6px 10px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .nav::-webkit-scrollbar { width: 5px; }
    .nav::-webkit-scrollbar-thumb { background: #1e2e48; border-radius: 4px; }
    .nav::-webkit-scrollbar-thumb:hover { background: #334155; }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 7px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      border: 0;
      background: transparent;
      width: 100%;
      text-align: left;
      transition: all 0.15s ease;
    }
    .nav-item:hover {
      background: var(--sidebar-hover);
      color: #fff;
    }
    .nav-item.active {
      background: var(--primary);
      color: #fff;
      font-weight: 600;
    }
    .nav-icon { width: 18px; text-align: center; flex-shrink: 0; font-size: 14px; }

    /* Collapsible Accordion Groups */
    .nav-group {
      margin-top: 2px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .nav-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 9px 12px;
      background: transparent;
      border: 0;
      border-radius: 7px;
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-align: left;
      letter-spacing: 0.01em;
      transition: all 0.15s;
    }
    .nav-group-header:hover {
      background: rgba(255,255,255,0.06);
      color: #fff;
    }
    .nav-group.open > .nav-group-header {
      color: #60a5fa;
    }
    .nav-group-title {
      display: flex;
      align-items: center;
      gap: 9px;
      flex: 1;
    }
    .nav-chevron {
      font-size: 10px;
      color: #64748b;
      transition: transform 0.2s ease;
      display: inline-block;
      padding: 2px 4px;
    }
    .nav-group.open .nav-chevron {
      transform: rotate(90deg);
      color: #94a3b8;
    }
    .nav-submenu {
      display: none;
      flex-direction: column;
      gap: 2px;
      padding-left: 14px;
      margin: 3px 0 6px 14px;
      border-left: 2px solid #1e2e48;
    }
    .nav-group.open .nav-submenu {
      display: flex;
    }
    .nav-submenu .nav-item {
      padding: 8px 10px;
      font-size: 12.5px;
      border-radius: 6px;
    }
    .nav-submenu .nav-item.active {
      background: #1e3a8a;
      color: #fff;
      font-weight: 600;
      box-shadow: inset 3px 0 0 #3b82f6;
    }'''

content_norm = content.replace('\r\n', '\n')
old_aside_norm = old_aside_css.replace('\r\n', '\n')
new_aside_norm = new_aside_css.replace('\r\n', '\n')

if old_aside_norm in content_norm:
    content_norm = content_norm.replace(old_aside_norm, new_aside_norm)
    print("Replaced aside CSS")
else:
    print("old_aside_norm not found")

# 2. Update <aside> and <nav> HTML
old_nav_marker = '<nav class="nav">'
end_nav_marker = '</nav>'

idx_nav1 = content_norm.find(old_nav_marker)
idx_nav2 = content_norm.find(end_nav_marker, idx_nav1)

new_nav_html = '''<div class="nav-controls">
      <span style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:.08em">Navigation</span>
      <button type="button" class="nav-toggle-all-btn" id="btnToggleAllNav" onclick="toggleAllNavGroups()" title="Expand or collapse all menu categories">⊞ Expand All</button>
    </div>

    <nav class="nav" id="sidebarNav">
      <!-- 1. Direct Dashboard Item -->
      <button class="nav-item active" data-view="overview">
        <span class="nav-icon">📊</span><span>Overview &amp; Metrics</span>
      </button>

      <!-- 2. Catalog & Products Group -->
      <div class="nav-group open" id="group-catalog">
        <button type="button" class="nav-group-header" onclick="toggleNavGroup('group-catalog')">
          <span class="nav-group-title"><span class="nav-icon">🛍️</span><span>Catalog &amp; Inventory</span></span>
          <span class="nav-chevron">▶</span>
        </button>
        <div class="nav-submenu">
          <button class="nav-item" data-view="products"><span class="nav-icon">📦</span><span>Products List</span></button>
          <button class="nav-item" data-view="categories"><span class="nav-icon">🗂️</span><span>Categories</span></button>
          <button class="nav-item" data-view="inventory"><span class="nav-icon">📊</span><span>Stock &amp; Inventory <span id="invLowBadge" class="badge badge-cancelled" style="display:none;margin-left:4px"></span></span></button>
          <a class="nav-item store-builder-nav-btn" id="sidebarStoreBuilderBtn" href="../store-builder/" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#FF6B00,#EA580C);color:#fff;font-weight:700;margin:4px 0 4px 0;border-radius:6px;box-shadow:0 2px 8px rgba(234,88,12,0.3);text-decoration:none;display:flex;align-items:center;gap:8px;padding:8px 10px">
            <span class="nav-icon" style="font-size:14px">🎨</span>
            <span>Store Builder CMS ↗</span>
          </a>
        </div>
      </div>

      <!-- 3. Orders & Fulfillment Group -->
      <div class="nav-group open" id="group-orders">
        <button type="button" class="nav-group-header" onclick="toggleNavGroup('group-orders')">
          <span class="nav-group-title"><span class="nav-icon">📦</span><span>Orders &amp; Deliveries</span></span>
          <span class="nav-chevron">▶</span>
        </button>
        <div class="nav-submenu">
          <button class="nav-item" data-view="orders"><span class="nav-icon">📋</span><span>Orders &amp; Fulfillment</span></button>
          <button class="nav-item" data-view="packaging"><span class="nav-icon">📮</span><span>Packaging &amp; Labels</span></button>
          <button class="nav-item" data-view="shipments" id="navShipments" style="display:none"><span class="nav-icon">🚚</span><span>Ekart Courier &amp; Tracking</span></button>
          <button class="nav-item" data-view="invoices"><span class="nav-icon">🧾</span><span>Invoices &amp; GST Tax Filing</span></button>
        </div>
      </div>

      <!-- 4. Customers & Outreach Group -->
      <div class="nav-group" id="group-customers">
        <button type="button" class="nav-group-header" onclick="toggleNavGroup('group-customers')">
          <span class="nav-group-title"><span class="nav-icon">👥</span><span>Customers &amp; Marketing</span></span>
          <span class="nav-chevron">▶</span>
        </button>
        <div class="nav-submenu">
          <button class="nav-item" data-view="customers"><span class="nav-icon">👤</span><span>Customers</span></button>
          <button class="nav-item" data-view="coupons"><span class="nav-icon">🏷️</span><span>Coupons &amp; Offers</span></button>
          <button class="nav-item" data-view="inbox"><span class="nav-icon">💬</span><span>Customer Inquiries (Inbox)</span></button>
          <button class="nav-item" data-view="whatsapp"><span class="nav-icon">🟢</span><span>WhatsApp Notifications</span></button>
        </div>
      </div>

      <!-- 5. Store Settings & Setup Group -->
      <div class="nav-group" id="group-settings">
        <button type="button" class="nav-group-header" onclick="toggleNavGroup('group-settings')">
          <span class="nav-group-title"><span class="nav-icon">⚙️</span><span>Store Setup &amp; Settings</span></span>
          <span class="nav-chevron">▶</span>
        </button>
        <div class="nav-submenu">
          <button class="nav-item" data-view="checkout"><span class="nav-icon">🛒</span><span>Checkout &amp; Razorpay</span></button>
          <button class="nav-item" data-view="shipping"><span class="nav-icon">🚚</span><span>Shipping Rates &amp; Rules</span></button>
          <button class="nav-item" data-view="theme"><span class="nav-icon">🎨</span><span>Theme &amp; Store Design</span></button>
          <button class="nav-item" data-view="display"><span class="nav-icon">👁️</span><span>Shop Display Settings</span></button>
          <button class="nav-item" data-view="pages"><span class="nav-icon">📄</span><span>Content &amp; Policy Pages</span></button>
          <button class="nav-item" data-view="deploy"><span class="nav-icon">🚀</span><span>Deploy &amp; Hosting</span></button>
          <button class="nav-item" data-view="settings"><span class="nav-icon">⚙️</span><span>General Settings &amp; Legal</span></button>
        </div>
      </div>
    </nav>'''

if idx_nav1 != -1 and idx_nav2 != -1:
    content_norm = content_norm[:idx_nav1] + new_nav_html + content_norm[idx_nav2 + len(end_nav_marker):]
    print("Replaced <nav> HTML")
else:
    print("Could not find <nav>")

# 3. Add JavaScript functions for nav accordion and update switchView
nav_js = '''
    // ── Collapsible Navigation Group Accordion ──
    function toggleNavGroup(groupId) {
      const grp = document.getElementById(groupId);
      if (!grp) return;
      grp.classList.toggle('open');
      try {
        const states = JSON.parse(localStorage.getItem('zk_nav_group_states') || '{}');
        states[groupId] = grp.classList.contains('open');
        localStorage.setItem('zk_nav_group_states', JSON.stringify(states));
      } catch (_) {}
    }

    function initNavGroupStates() {
      try {
        const states = JSON.parse(localStorage.getItem('zk_nav_group_states') || '{}');
        document.querySelectorAll('.nav-group').forEach(grp => {
          if (states[grp.id] !== undefined) {
            grp.classList.toggle('open', !!states[grp.id]);
          }
        });
      } catch (_) {}
    }

    function toggleAllNavGroups() {
      const grps = Array.from(document.querySelectorAll('.nav-group'));
      const anyClosed = grps.some(g => !g.classList.contains('open'));
      grps.forEach(g => g.classList.toggle('open', anyClosed));
      const btn = document.getElementById('btnToggleAllNav');
      if (btn) btn.textContent = anyClosed ? '⊟ Collapse All' : '⊞ Expand All';
      try {
        const states = {};
        grps.forEach(g => { states[g.id] = anyClosed; });
        localStorage.setItem('zk_nav_group_states', JSON.stringify(states));
      } catch (_) {}
    }
'''

# Update switchView to auto-open parent group when selecting an item
old_switch = '''    function switchView(viewName) {
      document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));'''

new_switch = nav_js + '''
    function switchView(viewName) {
      document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.nav-item').forEach(b => {
        const isActive = (b.dataset.view === viewName);
        b.classList.toggle('active', isActive);
        if (isActive) {
          const parentGroup = b.closest('.nav-group');
          if (parentGroup && !parentGroup.classList.contains('open')) {
            parentGroup.classList.add('open');
          }
        }
      });'''

if old_switch in content_norm:
    content_norm = content_norm.replace(old_switch, new_switch)
    print("Updated switchView and added accordion functions")
else:
    print("old_switch not found")

# Initialize nav state on load
old_init = "loadDashboard();"
new_init = "initNavGroupStates(); loadDashboard();"
if old_init in content_norm and 'initNavGroupStates' not in content_norm:
    content_norm = content_norm.replace(old_init, new_init, 1)
    print("Added initNavGroupStates call on load")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("Updated zkc/merchant/index.html")
