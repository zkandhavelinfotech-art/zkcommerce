/**
 * ZKCommerce v4.1 — Unified Utility Library
 * URL auto-detection: file:// → localhost:3000 | Railway/custom → env-based
 */
'use strict';

/* ── API base URL — works for ALL environments ───────────────
   file://        → http://localhost:3000/api  (local dev, HTML opened directly)
   localhost      → http://localhost:3000/api  (local dev via http-server)
   railway.app    → /api                       (Railway deployment, same-origin proxy)
   custom domain  → uses window.ZK_API_URL if injected, else /api
*/
window.ZK = window.ZK || {};

(function detectAPI() {
  var proto = window.location.protocol;
  var host  = window.location.hostname;

  // 1. Explicit JS override
  if (window.ZK_API_URL) { ZK.api = window.ZK_API_URL; return; }

  // 2. Meta tag override (<meta name="zk-api-url" content="https://api.zkcommerce.in/api">)
  var metaApi = document.querySelector('meta[name="zk-api-url"]');
  if (metaApi && metaApi.content) { ZK.api = metaApi.content; return; }

  // 3. Local file opened directly
  if (proto === 'file:') { ZK.api = 'http://localhost:3000/api'; return; }

  // 4. localhost or local IP dev
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
    ZK.api = 'http://localhost:3000/api'; return;
  }

  // 5. zkcommerce.in & subdomains (e.g. app.zkcommerce.in, smeram.zkcommerce.in)
  if (host.endsWith('zkcommerce.in')) {
    ZK.api = 'https://api.zkcommerce.in/api'; return;
  }

  // 6. Custom tenant domains (e.g. smeram-natural.in)
  if (host.endsWith('smeram-natural.in')) {
    ZK.api = 'https://api.zkcommerce.in/api'; return;
  }

  // 7. Vercel preview URLs
  if (host.endsWith('.vercel.app')) {
    ZK.api = window.RAILWAY_API_URL || 'https://api.zkcommerce.in/api';
    return;
  }

  // 8. Railway app domain
  if (host.endsWith('.railway.app')) {
    ZK.api = '/api'; return;
  }

  // Default production fallback for standalone frontends
  ZK.api = 'https://api.zkcommerce.in/api';
})();

/* ── Auth ─────────────────────────────────────────────────── */
var auth = {
  get token() {
    return localStorage.getItem('zk_token') || '';
  },
  get user() {
    try { return JSON.parse(localStorage.getItem('zk_user') || 'null'); }
    catch(e) { return null; }
  },
  save: function(token, user) {
    localStorage.setItem('zk_token', token);
    localStorage.setItem('zk_user', JSON.stringify(user));
  },
  clear: function() {
    localStorage.removeItem('zk_token');
    localStorage.removeItem('zk_user');
    localStorage.removeItem('zk_setup_complete');
    localStorage.removeItem('zk_store_slug');
    localStorage.removeItem('zk_cart');
    localStorage.removeItem('zk_coupon');
  },
  isLoggedIn: function() { return !!this.token && !this.token.startsWith('demo_token'); },
  requireAuth: function(redirectTo) {
    if (!this.token) {
      window.location.href = (redirectTo || '../auth/login.html');
      return false;
    }
    return true;
  }
};

/* ── Format helpers ───────────────────────────────────────── */
var fmt = {
  inr: function(amount, decimals) {
    var n = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
      minimumFractionDigits: decimals !== undefined ? decimals : 0,
      maximumFractionDigits: decimals !== undefined ? decimals : 0
    }).format(n);
  },
  inrCompact: function(amount) {
    var n = parseFloat(amount) || 0;
    if (n >= 10000000) return fmt.inr(n/10000000) + ' Cr';
    if (n >= 100000)   return fmt.inr(n/100000) + ' L';
    if (n >= 1000)     return fmt.inr(n/1000) + ' K';
    return fmt.inr(n);
  },
  orderId: function(id) { return '#ZK-' + String(id).padStart(5,'0'); },
  date: function(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  },
  datetime: function(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
      day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
  }
};

/* ── API helper ───────────────────────────────────────────── */
var api = {
  _req: async function(method, path, body) {
    var token = auth.token;
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body)  opts.body = JSON.stringify(body);
    var res  = await fetch(ZK.api + path, opts);
    var data = await res.json();
    return data;
  },
  get:    function(path)       { return this._req('GET',    path, null); },
  post:   function(path, body) { return this._req('POST',   path, body); },
  put:    function(path, body) { return this._req('PUT',    path, body); },
  delete: function(path)       { return this._req('DELETE', path, null); }
};

/* ── Cart (localStorage) ─────────────────────────────────── */
var cart = {
  get items() {
    try { return JSON.parse(localStorage.getItem('zk_cart') || '[]'); }
    catch(e) { return []; }
  },
  get count() { return this.items.reduce(function(s,i){ return s+i.quantity; }, 0); },
  get total() { return this.items.reduce(function(s,i){ return s+i.price*i.quantity; }, 0); },
  _save: function(items) {
    localStorage.setItem('zk_cart', JSON.stringify(items));
    this._updateBadge();
  },
  add: function(p) {
    var items = this.items;
    var ex = items.find(function(i){ return i.id===p.id; });
    if (ex) ex.quantity = (ex.quantity||1)+1;
    else items.push({ id:p.id, name:p.name, price:p.price, image:p.image||'', quantity:1 });
    this._save(items);
  },
  remove:  function(id) { this._save(this.items.filter(function(i){ return i.id!==id; })); },
  update:  function(id,qty) {
    var items = this.items;
    var item = items.find(function(i){ return i.id===id; });
    if (item) { item.quantity = Math.max(1,qty); this._save(items); }
  },
  clear:   function() { this._save([]); },
  _updateBadge: function() {
    var count = this.count;
    document.querySelectorAll('.cart-count').forEach(function(el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }
};

/* ── Toast ───────────────────────────────────────────────── */
var toast = (function() {
  var queue = [], showing = false;
  function show(msg, type) { queue.push({msg:msg, type:type||'info'}); if(!showing) next(); }
  function next() {
    if (!queue.length) { showing=false; return; }
    showing = true;
    var item = queue.shift();
    var el = document.getElementById('zk-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zk-toast';
      el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
      document.body.appendChild(el);
    }
    var C = {
      success:{bg:'#F0FDF4',border:'#22C55E',color:'#15803D',icon:'&#10003;'},
      error:  {bg:'#FEF2F2',border:'#EF4444',color:'#DC2626',icon:'&#10007;'},
      warning:{bg:'#FFFBEB',border:'#F59E0B',color:'#92400E',icon:'&#9888;'},
      info:   {bg:'#EFF6FF',border:'#3B82F6',color:'#1D4ED8',icon:'&#8505;'}
    };
    var c = C[item.type] || C.info;
    var t = document.createElement('div');
    t.style.cssText = 'background:'+c.bg+';border:1px solid '+c.border+';color:'+c.color
      +';padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600'
      +';font-family:"Plus Jakarta Sans",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.12)'
      +';display:flex;align-items:center;gap:8px;max-width:340px;pointer-events:auto';
    t.innerHTML = '<span>'+c.icon+'</span><span>'+item.msg+'</span>';
    el.appendChild(t);
    if (!document.getElementById('zk-spin-css')) {
      var s = document.createElement('style');
      s.id = 'zk-spin-css';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:none;opacity:1}}';
      document.head.appendChild(s);
    }
    t.style.animation = 'slideIn .2s ease';
    setTimeout(function(){
      t.style.transition='opacity .3s,transform .3s';
      t.style.opacity='0'; t.style.transform='translateX(110%)';
      setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); next(); }, 300);
    }, 3200);
  }
  return {
    success: function(m){ show(m,'success'); },
    error:   function(m){ show(m,'error'); },
    warning: function(m){ show(m,'warning'); },
    info:    function(m){ show(m,'info'); }
  };
})();

/* ── Button loading ──────────────────────────────────────── */
function btnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px"></span>Loading...';
    btn.disabled = true;
  } else {
    if (btn._orig) btn.innerHTML = btn._orig;
    btn.disabled = false;
  }
}

/* ── GST split ───────────────────────────────────────────── */
var gst = {
  split: function(amount, rate) {
    var r = parseFloat(rate)/100;
    var base = amount/(1+r);
    var half = (amount-base)/2;
    return { base: Math.round(base*100)/100, cgst: Math.round(half*100)/100, sgst: Math.round(half*100)/100 };
  }
};

/* ── Loyalty ─────────────────────────────────────────────── */
var loyalty = {
  tier: function(pts) { return pts>=25000?'Gold':pts>=5000?'Silver':'Bronze'; },
  worth: function(pts) { return pts*0.5; }
};

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  cart._updateBadge();
  var user = auth.user;
  if (user) {
    document.querySelectorAll('.zk-merchant-name').forEach(function(el){ el.textContent = user.name||user.email||''; });
    document.querySelectorAll('.zk-merchant-initial').forEach(function(el){ el.textContent = (user.name||user.email||'U')[0].toUpperCase(); });
  }
});
