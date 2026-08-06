/* ═══════════════════════════════════════════════════════
   ZKCommerce App Utilities v3
   ZKanadavel Infotech Pvt Ltd & ZK Infotech INC
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── CONFIG ────────────────────────────────────────── */
const ZK = {
  version: '3.0.0',
  brand:   'ZKCommerce',
  company: 'ZKanadavel Infotech Pvt Ltd',
  api:     window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api',
  currency:'₹',
};

/* ── FORMAT HELPERS ────────────────────────────────── */
const fmt = {
  /** Format number as Indian currency: ₹1,23,456 */
  inr(n, decimals = 0) {
    if (n === null || n === undefined) return '₹0';
    return ZK.currency + Number(n).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  /** Compact INR: ₹1.2L, ₹4.5Cr */
  inrCompact(n) {
    if (n >= 10000000) return ZK.currency + (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000)   return ZK.currency + (n / 100000).toFixed(1) + 'L';
    if (n >= 1000)     return ZK.currency + (n / 1000).toFixed(1) + 'K';
    return fmt.inr(n);
  },

  /** Date: 15 Jul 2026 */
  date(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dt = new Date(d);
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  },

  /** DateTime: 15 Jul 2026, 10:32 AM */
  datetime(d) {
    const dt = new Date(d);
    const time = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${fmt.date(d)}, ${time}`;
  },

  /** Relative time: 2 hours ago */
  relative(d) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30)  return `${days}d ago`;
    return fmt.date(d);
  },

  /** Order ID: #ZK-2026-00123 */
  orderId(id) {
    return `#ZK-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
  },

  /** Truncate: "Long text that..." */
  truncate(str, n = 40) {
    return str && str.length > n ? str.slice(0, n) + '…' : (str || '');
  },

  /** Phone: +91 98765 43210 */
  phone(p) {
    const s = String(p).replace(/\D/g, '');
    if (s.length === 10) return `+91 ${s.slice(0,5)} ${s.slice(5)}`;
    return p;
  },

  /** Percentage change */
  pct(val, total) {
    if (!total) return '0%';
    return (val / total * 100).toFixed(1) + '%';
  },
};

/* ── API HELPER ────────────────────────────────────── */
const api = {
  token: () => localStorage.getItem('zk_token'),

  headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = api.token();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  async get(path) {
    const res = await fetch(ZK.api + path, { headers: api.headers() });
    if (res.status === 401) { auth.logout(); return null; }
    return res.json();
  },

  async post(path, data) {
    const res = await fetch(ZK.api + path, {
      method: 'POST', headers: api.headers(), body: JSON.stringify(data),
    });
    return res.json();
  },

  async put(path, data) {
    const res = await fetch(ZK.api + path, {
      method: 'PUT', headers: api.headers(), body: JSON.stringify(data),
    });
    return res.json();
  },

  async del(path) {
    const res = await fetch(ZK.api + path, {
      method: 'DELETE', headers: api.headers(),
    });
    return res.json();
  },

  async upload(path, formData) {
    const h = {};
    const t = api.token();
    if (t) h['Authorization'] = `Bearer ${t}`;
    const res = await fetch(ZK.api + path, { method: 'POST', headers: h, body: formData });
    return res.json();
  },
};

/* ── AUTH ──────────────────────────────────────────── */
const auth = {
  get user()  { try { return JSON.parse(localStorage.getItem('zk_user') || 'null'); } catch { return null; } },
  get token() { return localStorage.getItem('zk_token'); },

  isLoggedIn() { return !!this.token && !!this.user; },

  save(token, user) {
    localStorage.setItem('zk_token', token);
    localStorage.setItem('zk_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('zk_token');
    localStorage.removeItem('zk_user');
    localStorage.removeItem('zk_cart');
    window.location.href = '/auth/login.html';
  },

  requireAuth(role = null) {
    if (!this.isLoggedIn()) {
      window.location.href = '/auth/login.html?next=' + encodeURIComponent(location.pathname);
      return false;
    }
    if (role && this.user?.role !== role) {
      toast.error('Access denied');
      return false;
    }
    return true;
  },

  isMerchant() { return this.user?.role === 'merchant'; },
  isAdmin()    { return this.user?.role === 'admin'; },
  isCustomer() { return this.user?.role === 'customer'; },
};

/* ── TOAST NOTIFICATIONS ────────────────────────────── */
const toast = {
  show(message, type = 'info', duration = 3500) {
    const existing = document.querySelector('.zk-toast');
    if (existing) existing.remove();

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `zk-toast zk-toast-${type}`;
    el.innerHTML = `<span>${icons[type] || '💬'}</span><span>${message}</span>`;
    document.body.appendChild(el);

    setTimeout(() => {
      el.style.animation = 'slideUp .3s ease reverse';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },
  success(msg, d) { this.show(msg, 'success', d); },
  error(msg, d)   { this.show(msg, 'error', d); },
  info(msg, d)    { this.show(msg, 'info', d); },
  warning(msg, d) { this.show(msg, 'warning', d); },
};

/* ── CART ───────────────────────────────────────────── */
const cart = {
  get items() { try { return JSON.parse(localStorage.getItem('zk_cart') || '[]'); } catch { return []; } },
  save(items) { localStorage.setItem('zk_cart', JSON.stringify(items)); cart.updateBadge(); },

  add(product, qty = 1, variant = null) {
    const items = this.items;
    const key = `${product.id}_${variant?.id || 'default'}`;
    const existing = items.find(i => i.key === key);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ key, product, variant, qty, addedAt: Date.now() });
    }
    this.save(items);
    toast.success(`${fmt.truncate(product.name, 24)} added to cart`);
  },

  remove(key) {
    this.save(this.items.filter(i => i.key !== key));
  },

  update(key, qty) {
    if (qty < 1) return this.remove(key);
    const items = this.items;
    const item = items.find(i => i.key === key);
    if (item) { item.qty = qty; this.save(items); }
  },

  clear() { localStorage.removeItem('zk_cart'); cart.updateBadge(); },

  get count() { return this.items.reduce((s, i) => s + i.qty, 0); },

  get subtotal() {
    return this.items.reduce((s, i) => {
      const price = i.variant?.price || i.product.price;
      return s + price * i.qty;
    }, 0);
  },

  updateBadge() {
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = cart.count;
      el.style.display = cart.count > 0 ? 'flex' : 'none';
    });
  },
};

/* ── NAV SCROLL EFFECT ──────────────────────────────── */
function initNav() {
  const nav = document.getElementById('nav') || document.querySelector('.zk-nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── SIDEBAR ACTIVE LINK ────────────────────────────── */
function initSidebar() {
  const path = location.pathname;
  document.querySelectorAll('.zk-sidebar-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href && path.includes(href.replace('../', '').replace('.html', ''))) {
      link.classList.add('active');
    }
  });
}

/* ── ACCORDION ──────────────────────────────────────── */
function initAccordion() {
  document.querySelectorAll('.zk-accordion-q, .faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.zk-accordion-item, .faq-item, .fi');
      const isOpen = item.classList.contains('open');
      item.closest('.zk-accordion, .faq-list, div')
        ?.querySelectorAll('.zk-accordion-item.open, .faq-item.open, .fi.open')
        .forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ── SMOOTH SCROLL ──────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}

/* ── TABS ───────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.zk-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('[data-tabs]') || tab.parentElement;
      const target = tab.dataset.tab;
      group.querySelectorAll('.zk-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (target) {
        document.querySelectorAll(`[data-tab-panel]`).forEach(p => {
          p.style.display = p.dataset.tabPanel === target ? 'block' : 'none';
        });
      }
    });
  });
}

/* ── FORM VALIDATION ────────────────────────────────── */
const validate = {
  email(v)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
  phone(v)  { return /^[6-9]\d{9}$/.test(v.replace(/\D/g,'')); },
  gstin(v)  { return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.toUpperCase()); },
  pincode(v){ return /^[1-9][0-9]{5}$/.test(v); },
  required(v){ return v !== null && v !== undefined && String(v).trim() !== ''; },

  form(formEl) {
    let valid = true;
    formEl.querySelectorAll('[required]').forEach(field => {
      const err = field.parentElement.querySelector('.field-error');
      if (!validate.required(field.value)) {
        field.style.borderColor = '#DC2626';
        if (err) err.textContent = 'This field is required';
        valid = false;
      } else if (field.type === 'email' && !validate.email(field.value)) {
        field.style.borderColor = '#DC2626';
        if (err) err.textContent = 'Enter a valid email address';
        valid = false;
      } else {
        field.style.borderColor = '';
        if (err) err.textContent = '';
      }
    });
    return valid;
  },
};

/* ── COPY TO CLIPBOARD ──────────────────────────────── */
async function copyText(text, label = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Could not copy');
  }
}

/* ── LOADING BUTTON ─────────────────────────────────── */
function btnLoading(btn, loading = true) {
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = '<div class="zk-spinner" style="width:16px;height:16px;border-width:2px"></div> Loading…';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalText || 'Submit';
    btn.disabled = false;
  }
}

/* ── DEBOUNCE ───────────────────────────────────────── */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/* ── LOCAL STORAGE HELPERS ──────────────────────────── */
const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del(key)      { localStorage.removeItem(key); },
};

/* ── GST CALCULATOR ─────────────────────────────────── */
const gst = {
  rates: { '5': .05, '12': .12, '18': .18, '28': .28 },

  split(amount, rateStr, isInclusive = true) {
    const rate = gst.rates[rateStr] || 0;
    const base = isInclusive ? amount / (1 + rate) : amount;
    const total = base * rate;
    return {
      base:  Math.round(base * 100) / 100,
      cgst:  Math.round(total / 2 * 100) / 100,
      sgst:  Math.round(total / 2 * 100) / 100,
      total: Math.round(total * 100) / 100,
      gross: Math.round((base + total) * 100) / 100,
    };
  },
};

/* ── LOYALTY POINTS ─────────────────────────────────── */
const loyalty = {
  RATE: 1,        // 1 point per ₹1 spent
  VALUE: 0.50,    // 1 point = ₹0.50

  earn(amount)  { return Math.floor(amount * this.RATE); },
  worth(points) { return points * this.VALUE; },
  fmt(points)   { return points.toLocaleString('en-IN') + ' pts'; },
};

/* ── INIT ON DOM READY ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initSidebar();
  initAccordion();
  initSmoothScroll();
  initTabs();
  cart.updateBadge();
});

/* ── EXPORT (for module contexts) ───────────────────── */
if (typeof module !== 'undefined') {
  module.exports = { ZK, fmt, api, auth, toast, cart, validate, gst, loyalty, debounce, store };
}
