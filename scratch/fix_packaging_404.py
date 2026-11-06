import os, shutil

# 1. Update packaging_api.php
for pkg_path in ['zkc/api/services/php/packaging_api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/packaging_api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/packaging_api.php']:
    if not os.path.exists(pkg_path):
        continue
    with open(pkg_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Route 1: packaging
    old_r1 = "if ($route === 'admin/packaging' && $method === 'GET') {"
    new_r1 = "if (($route === 'admin/packaging' || $route === 'orders/packaging' || $route === 'packaging') && $method === 'GET') {"
    if old_r1 in content:
        content = content.replace(old_r1, new_r1)
        print(f"Updated r1 in {pkg_path}")

    # Stages update: include 'paid' in ready stage
    old_stage = "$stages = ['ready' => \"o.order_status IN ('new','confirmed')\", 'packed' => \"o.order_status = 'processing'\", 'shipped' => \"o.order_status = 'shipped'\", 'all' => \"o.order_status NOT IN ('pending','cancelled')\"];"
    new_stage = "$stages = ['ready' => \"(o.order_status IN ('new','confirmed','paid') OR (o.payment_status = 'paid' AND o.order_status NOT IN ('cancelled','delivered','shipped','processing')) OR (o.payment_method = 'cod' AND o.order_status NOT IN ('cancelled','delivered','shipped','processing')))\", 'packed' => \"o.order_status = 'processing'\", 'shipped' => \"o.order_status = 'shipped'\", 'all' => \"o.order_status NOT IN ('cancelled')\"];"
    if old_stage in content:
        content = content.replace(old_stage, new_stage)
        print(f"Updated stages in {pkg_path}")

    # Route 2: mark-packed
    old_r2 = "if ($route === 'admin/mark-packed' && $method === 'POST') {"
    new_r2 = "if (($route === 'admin/mark-packed' || $route === 'orders/packaging/mark-packed' || $route === 'packaging/mark-packed') && $method === 'POST') {"
    if old_r2 in content:
        content = content.replace(old_r2, new_r2)
        print(f"Updated r2 in {pkg_path}")

    # Route 3: shipments
    old_r3 = "if ($route === 'admin/shipments' && $method === 'GET') {"
    new_r3 = "if (($route === 'admin/shipments' || $route === 'shipments/orders' || $route === 'shipments') && $method === 'GET') {"
    if old_r3 in content:
        content = content.replace(old_r3, new_r3)
        print(f"Updated r3 in {pkg_path}")

    # Route 4: awb
    old_r4 = "if ($route === 'admin/awb' && $method === 'PUT') {\n            $o = zkcAssignAwb($pdo, (int)($body['order_id'] ?? 0), $body['awb'] ?? null, $body['courier'] ?? '');"
    new_r4 = """if (($route === 'admin/awb' || preg_match('#^shipments/orders/(\\\\d+)/awb#', $route, $m)) && $method === 'PUT') {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($body['order_id'] ?? 0);
            $o = zkcAssignAwb($pdo, $oid, $body['awb'] ?? null, $body['courier'] ?? '');"""
    if old_r4 in content:
        content = content.replace(old_r4, new_r4)
        print(f"Updated r4 in {pkg_path}")

    # Route 5: status
    old_r5 = "if ($route === 'admin/status' && $method === 'PUT') {\n            $status = ($body['status'] ?? '') === 'confirmed' ? 'new' : (string)($body['status'] ?? '');\n            $r = zkcChangeStatus($pdo, (int)($body['order_id'] ?? 0), $status, $body['tracking_number'] ?? null);"
    new_r5 = """if (($route === 'admin/status' || preg_match('#^orders/(\\\\d+)/status#', $route, $m)) && $method === 'PUT') {
            $oid = !empty($m[1]) ? (int)$m[1] : (int)($body['order_id'] ?? 0);
            $status = ($body['status'] ?? '') === 'confirmed' ? 'new' : (string)($body['status'] ?? '');
            $r = zkcChangeStatus($pdo, $oid, $status, $body['tracking_number'] ?? null);"""
    if old_r5 in content:
        content = content.replace(old_r5, new_r5)
        print(f"Updated r5 in {pkg_path}")

    with open(pkg_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {pkg_path}")

# 2. Update api.php
for api_path in ['zkc/api/services/php/api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api.php']:
    if not os.path.exists(api_path):
        continue
    with open(api_path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_gate = "if (strpos($route, 'admin/') === 0 || strpos($route, 'orders/packaging') === 0 || ($route === 'shipments/orders') || preg_match('#^shipments/orders/\\d+/awb#', $route)) zkcHandleAdminRoute($pdo, $route, $method, $body);"
    new_gate = "if (strpos($route, 'admin/') === 0 || strpos($route, 'orders/packaging') === 0 || strpos($route, 'packaging') === 0 || strpos($route, 'shipments') === 0 || preg_match('#^orders/\\d+/status#', $route)) zkcHandleAdminRoute($pdo, $route, $method, $body);"
    if old_gate in content:
        content = content.replace(old_gate, new_gate)
        print(f"Updated admin gate in {api_path}")

    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {api_path}")

# 3. Update packaging.html
for pkg_html in ['zkc/merchant/packaging.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/packaging.html']:
    if not os.path.exists(pkg_html):
        continue
    with open(pkg_html, 'r', encoding='utf-8') as f:
        content = f.read()

    old_api_block = """// Two hosts share this page: the Node dashboard (login token) and the PHP package's packaging.php (admin session, api.php).
const PHP_MODE = !!window.ZKC_PACKAGING_PHP;
const API = '/api', token = PHP_MODE ? '' : localStorage.getItem('zk_token');
const PHP_ROUTES = { '/orders/packaging': 'admin/packaging', '/orders/packaging/mark-packed': 'admin/mark-packed' };
const storeId = new URLSearchParams(location.search).get('store_id');
let data = { orders: [], store: {} }, selected = new Set();

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600e3 - offsetDays * 864e5).toISOString().slice(0, 10);
const parse = v => { if (v == null) return null; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (_) { return v; } };
const addr = o => { const a = parse(o.shipping_address) || {}; return typeof a === 'string' ? { line1: a } : a; };
const items = o => { const i = parse(o.items); return Array.isArray(i) ? i : []; };
const isCod = o => o.payment_method === 'cod';
const status = (t, color) => { const el = document.getElementById('status'); el.textContent = t; el.style.color = color || '#64748b'; };
const withStore = p => p + (storeId ? (p.includes('?') ? '&' : '?') + 'store_id=' + encodeURIComponent(storeId) : '');

async function api(path, opts = {}) {
  let url = API + withStore(path), headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (PHP_MODE) {
    const [p, q] = path.split('?');
    url = 'api.php?route=' + encodeURIComponent(PHP_ROUTES[p] || p.replace(/^\\//, '')) + (q ? '&' + q : '');
    headers = { 'Content-Type': 'application/json' };
  }
  const r = await fetch(url, { ...opts, credentials: 'same-origin', headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || 'Request failed (' + r.status + ')');
  return d;
}"""

    new_api_block = """// Dual-host support: Node dashboard (/api/...) and PHP GoDaddy deployment (../api.php?route=...)
const PHP_MODE = !!window.ZKC_PACKAGING_PHP || !location.port || location.port === '80' || location.port === '443' || location.pathname.endsWith('.php') || !localStorage.getItem('zk_token');
const API = '/api', token = localStorage.getItem('zk_token');
const PHP_ROUTES = {
  '/orders/packaging': 'admin/packaging',
  '/orders/packaging/mark-packed': 'admin/mark-packed',
  'orders/packaging': 'admin/packaging',
  'orders/packaging/mark-packed': 'admin/mark-packed'
};
const storeId = new URLSearchParams(location.search).get('store_id');
let data = { orders: [], store: {} }, selected = new Set();

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600e3 - offsetDays * 864e5).toISOString().slice(0, 10);
const parse = v => { if (v == null) return null; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (_) { return v; } };
const addr = o => { const a = parse(o.shipping_address) || {}; return typeof a === 'string' ? { line1: a } : a; };
const items = o => { const i = parse(o.items); return Array.isArray(i) ? i : []; };
const isCod = o => o.payment_method === 'cod';
const status = (t, color) => { const el = document.getElementById('status'); el.textContent = t; el.style.color = color || '#64748b'; };
const withStore = p => p + (storeId ? (p.includes('?') ? '&' : '?') + 'store_id=' + encodeURIComponent(storeId) : '');

async function api(path, opts = {}) {
  const parts = path.replace(/^\\//, '').split('?');
  const cleanRoute = parts[0];
  const qs = parts[1] ? '&' + parts[1] : '';
  const storeParam = storeId ? (qs.includes('store_id=') ? '' : '&store_id=' + encodeURIComponent(storeId)) : '';

  const phpRouteName = PHP_ROUTES['/' + cleanRoute] || PHP_ROUTES[cleanRoute] || cleanRoute;
  const phpBase = location.pathname.includes('/merchant/') ? '../api.php' : 'api.php';
  const phpUrl = phpBase + '?route=' + encodeURIComponent(phpRouteName) + qs + storeParam;
  const nodeUrl = API + withStore(path);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(opts.headers || {})
  };

  let r;
  // If in PHP environment or no token, try PHP endpoint first
  if (PHP_MODE || !token) {
    try {
      r = await fetch(phpUrl, { ...opts, credentials: 'same-origin', headers });
    } catch (_) {}
  }

  // If PHP was not tried or failed, try Node endpoint
  if (!r || !r.ok) {
    try {
      const nodeRes = await fetch(nodeUrl, { ...opts, credentials: 'same-origin', headers });
      if (nodeRes && nodeRes.ok) r = nodeRes;
      else if (!r) r = nodeRes;
    } catch (_) {}
  }

  // If Node also failed or wasn't tried, and PHP was not successful, fallback to PHP
  if (!r || !r.ok) {
    try {
      const phpRes = await fetch(phpUrl, { ...opts, credentials: 'same-origin', headers });
      if (phpRes && phpRes.ok) r = phpRes;
      else if (!r) r = phpRes;
    } catch (_) {}
  }

  if (!r) throw Error('Network request failed');
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || 'Request failed (' + r.status + ')');
  return d;
}"""

    if old_api_block in content:
        content = content.replace(old_api_block, new_api_block)
        print(f"Updated API block in {pkg_html}")
    else:
        print(f"Old API block not found in {pkg_html}")

    with open(pkg_html, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {pkg_html}")

# 4. Copy favicon.ico to root and deployment
if os.path.exists('zkc/deployment/smeram-godaddy/favicon.ico'):
    shutil.copy2('zkc/deployment/smeram-godaddy/favicon.ico', 'zkc/favicon.ico')
    shutil.copy2('zkc/deployment/smeram-godaddy/favicon.ico', 'zkc/deployment/smeram-patch-today-v1.0.15/favicon.ico')
    print("Copied favicon.ico")

