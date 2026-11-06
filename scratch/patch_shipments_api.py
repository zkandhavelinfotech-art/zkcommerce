import os

for ship_path in ['zkc/merchant/shipments.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/shipments.html']:
    if not os.path.exists(ship_path):
        continue
    with open(ship_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix PHP_MODE
    old_php_mode = "const PHP_MODE = !!window.ZKC_SHIPMENTS_PHP;"
    new_php_mode = "const PHP_MODE = !!window.ZKC_SHIPMENTS_PHP || !location.port || location.port === '80' || location.port === '443' || location.pathname.endsWith('.php') || !localStorage.getItem('zk_token');"
    if old_php_mode in content:
        content = content.replace(old_php_mode, new_php_mode)

    # Fix phpRoute base path and storeId
    old_php_route = """function phpRoute(path, opts) {
  const [p, q] = path.split('?');
  let m, route = null, body = opts.body ? JSON.parse(opts.body) : {};
  if (p === '/shipments/orders') route = 'admin/shipments';
  else if ((m = p.match(/^\\/shipments\\/orders\\/(\\d+)\\/awb$/))) { route = 'admin/awb'; body.order_id = Number(m[1]); }
  else if ((m = p.match(/^\\/shipments\\/orders\\/(\\d+)\\/book$/))) route = 'admin/book';
  else if ((m = p.match(/^\\/orders\\/(\\d+)\\/status$/))) { route = 'admin/status'; body.order_id = Number(m[1]); }
  if (!route) throw Error('Not available on this site');
  return { url: 'api.php?route=' + encodeURIComponent(route) + (q ? '&' + q : ''), opts: { ...opts, body: opts.body || opts.method === 'PUT' ? JSON.stringify(body) : undefined } };
}
async function api(path, opts = {}) {
  let url = API + withStore(path), headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (PHP_MODE) { const t = phpRoute(path, opts); url = t.url; opts = t.opts; headers = { 'Content-Type': 'application/json' }; }
  const r = await fetch(url, { ...opts, credentials: 'same-origin', headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || 'Request failed (' + r.status + ')');
  return d;
}"""

    new_php_route = """function phpRoute(path, opts) {
  const [p, q] = path.split('?');
  let m, route = null, body = opts.body ? JSON.parse(opts.body) : {};
  if (p === '/shipments/orders' || p === 'shipments/orders') route = 'admin/shipments';
  else if ((m = p.match(/^\\/?shipments\\/orders\\/(\\d+)\\/awb$/))) { route = 'admin/awb'; body.order_id = Number(m[1]); }
  else if ((m = p.match(/^\\/?shipments\\/orders\\/(\\d+)\\/book$/))) route = 'admin/book';
  else if ((m = p.match(/^\\/?orders\\/(\\d+)\\/status$/))) { route = 'admin/status'; body.order_id = Number(m[1]); }
  if (!route) route = p.replace(/^\\//, '');
  const phpBase = location.pathname.includes('/merchant/') ? '../api.php' : 'api.php';
  const storeParam = storeId ? (q && q.includes('store_id=') ? '' : '&store_id=' + encodeURIComponent(storeId)) : '';
  return { url: phpBase + '?route=' + encodeURIComponent(route) + (q ? '&' + q : '') + storeParam, opts: { ...opts, body: opts.body || opts.method === 'PUT' ? JSON.stringify(body) : undefined } };
}
async function api(path, opts = {}) {
  let url = API + withStore(path), headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  let r, optsCopy = { ...opts };
  if (PHP_MODE || !token) {
    try {
      const t = phpRoute(path, optsCopy);
      r = await fetch(t.url, { ...t.opts, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    } catch (_) {}
  }
  if (!r || !r.ok) {
    try {
      const nodeRes = await fetch(url, { ...optsCopy, credentials: 'same-origin', headers });
      if (nodeRes && nodeRes.ok) r = nodeRes;
      else if (!r) r = nodeRes;
    } catch (_) {}
  }
  if (!r || !r.ok) {
    try {
      const t2 = phpRoute(path, optsCopy);
      const phpRes = await fetch(t2.url, { ...t2.opts, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
      if (phpRes && phpRes.ok) r = phpRes;
      else if (!r) r = phpRes;
    } catch (_) {}
  }
  if (!r) throw Error('Network request failed');
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || 'Request failed (' + r.status + ')');
  return d;
}"""

    if old_php_route in content:
        content = content.replace(old_php_route, new_php_route)
        print(f"Updated shipments API in {ship_path}")

    # Fix login redirect guard
    old_guard = "if (!PHP_MODE && !token) location.href = '../auth/login.html'; else load();"
    new_guard = "if (!PHP_MODE && !token && location.port && location.port !== '80' && location.port !== '443') location.href = '../auth/login.html'; else load();"
    if old_guard in content:
        content = content.replace(old_guard, new_guard)
        print(f"Updated login guard in {ship_path}")

    with open(ship_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {ship_path}")
