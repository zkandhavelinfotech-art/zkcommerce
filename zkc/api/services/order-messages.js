// WhatsApp order messages without the WhatsApp Business API.
//
// The merchant writes templates with {placeholders}. Messages are delivered by click-to-chat links
// (wa.me): after checkout the customer's own WhatsApp opens with the order typed out to the store's
// customer-care number, and the dashboard has one-click buttons to message a customer. If an official
// provider is configured (Gupshup / Meta Cloud API / webhook, see whatsapp.js) the same text is sent automatically.
//
// To add a field: add one entry to PLACEHOLDERS. It appears in the dashboard's field list, the Node
// server and the exported PHP site (which receives the same values from api.php).
const pool = require('../db');

const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const parseJson = (v, fallback) => { if (v == null) return fallback; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (_) { return fallback; } };
const addressOf = o => {
  const a = parseJson(o.shipping_address, {}) || {};
  return typeof a === 'string' ? { line1: a } : a;
};
const itemsOf = o => {
  const items = parseJson(o.items != null ? o.items : o.items_json, []);
  return Array.isArray(items) ? items : [];
};
const dateIn = (o, opts) => new Date(o.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });

// key → [label, value(order, store)]
const PLACEHOLDERS = {
  order_id:        ['Order ID', o => o.order_number || ('#' + o.id)],
  customer_name:   ['Customer name', o => o.customer_name || ''],
  customer_phone:  ['Customer phone', o => o.customer_phone || ''],
  customer_email:  ['Customer email', o => o.customer_email || ''],
  products:        ['Products (one per line, qty × price)', o => itemsOf(o).map((x, i) => `${i + 1}. ${x.name || 'Item'}${x.size || x.product_size ? ' (' + (x.size || x.product_size) + ')' : ''} × ${x.quantity || 1} — ${money((x.price || 0) * (x.quantity || 1))}`).join('\n')],
  product_names:   ['Product names only', o => itemsOf(o).map(x => x.name).filter(Boolean).join(', ')],
  item_count:      ['Total quantity', o => String(itemsOf(o).reduce((n, x) => n + (Number(x.quantity) || 1), 0))],
  total:           ['Order total', o => money(o.total_amount)],
  payment_method:  ['Payment method', o => (o.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online (Razorpay)')],
  payment_status:  ['Payment status', o => o.payment_status || ''],
  address:         ['Full delivery address', o => { const a = addressOf(o); return [a.line1 || a.address, a.city || o.city, a.state || o.state, a.pincode || o.pincode].filter(Boolean).join(', '); }],
  city:            ['City', o => addressOf(o).city || o.city || ''],
  pincode:         ['PIN code', o => addressOf(o).pincode || o.pincode || ''],
  order_date:      ['Order date', o => dateIn(o, { day: '2-digit', month: 'short', year: 'numeric' })],
  order_time:      ['Order time', o => dateIn(o, { hour: '2-digit', minute: '2-digit' })],
  tracking_number: ['Tracking number', o => o.tracking_number || ''],
  store_name:      ['Store name', (o, s) => (s && s.store_name) || ''],
  courier:         ['Courier (shipped message)', o => o.courier || ''],
  tracking_url:    ['Tracking link (shipped message)', o => o.tracking_url || ''],
  // Low-stock alert fields (filled from the product, not an order).
  product_name:    ['Product name (low-stock alert)', () => ''],
  variant:         ['Variant / size (low-stock alert)', () => ''],
  stock_left:      ['Units left (low-stock alert)', () => ''],
  threshold:       ['Low-stock level (low-stock alert)', () => '']
};

const DEFAULTS = {
  enabled: true,
  care_number: '',
  care_label: 'Customer Care',
  // After checkout, open the customer's WhatsApp with the order typed out to care_number.
  customer_handoff: true,
  care_template: `🛍️ *New Order — {store_name}*
*Order ID:* {order_id}
*Name:* {customer_name}
*Phone:* {customer_phone}

*Products:*
{products}

*Total:* {total} ({payment_method})
*Address:* {address}
*Date:* {order_date} {order_time}`,
  customer_template: `Hello {customer_name}, thank you for shopping with {store_name}! 🙏
Your order *{order_id}* ({total}) is confirmed.

{products}

Delivery to: {address}
We will share tracking details once it ships.`,
  low_stock_template: `⚠️ *Low stock — {store_name}*
{product_name} {variant}
Only *{stock_left}* left (alert level {threshold}).
Restock soon to avoid missing orders.`,
  shipped_template: `🚚 Hello {customer_name}, your {store_name} order *{order_id}* has shipped with {courier}.
Track it here: {tracking_url}`,
  delivered_template: `✅ Hello {customer_name}, your {store_name} order *{order_id}* has been delivered.
Thank you for shopping with us! Reply here if anything is not right.`
};

function cleanPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  return d.length >= 10 ? d : '';
}

// extra: values for message-specific fields, e.g. { product_name, variant, quantity, threshold } in a low-stock alert.
function render(template, order, store, extra = {}) {
  return String(template || '').replace(/\{([a-z_]+)\}/g, (m, key) => (Object.prototype.hasOwnProperty.call(extra, key) ? String(extra[key] ?? '')
    : PLACEHOLDERS[key] ? String(PLACEHOLDERS[key][1](order || {}, store) ?? '') : m));
}

const waLink = (phone, text) => { const p = cleanPhone(phone); return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : null; };

function normalize(raw, store) {
  const s = { ...DEFAULTS, ...(raw || {}) };
  // Until the merchant sets one, care messages go to the store's WhatsApp number.
  if (!s.care_number) s.care_number = (store && store.whatsapp_number) || '';
  return s;
}

let columnReady = null;
function ensureColumn() {
  // Column comes from pg-migrations (002_store_settings_columns).
  if (!columnReady) columnReady = require('./pg-migrations').ready().catch(e => { columnReady = null; throw e; });
  return columnReady;
}

async function loadSettings(storeId) {
  await ensureColumn();
  const { rows } = await pool.query('SELECT id, store_name, whatsapp_number, whatsapp_settings FROM stores WHERE id=$1', [storeId]);
  return rows.length ? normalize(rows[0].whatsapp_settings, rows[0]) : null;
}

async function saveSettings(storeId, body) {
  await ensureColumn();
  const next = {};
  for (const k of ['care_template', 'customer_template', 'low_stock_template', 'shipped_template', 'delivered_template', 'care_label']) if (body[k] !== undefined) next[k] = String(body[k]).slice(0, 3000);
  for (const k of ['enabled', 'customer_handoff']) if (body[k] !== undefined) next[k] = !!body[k];
  if (body.care_number !== undefined) {
    const p = cleanPhone(body.care_number);
    if (body.care_number && !p) throw Object.assign(new Error('Enter the customer-care WhatsApp number with country code, e.g. +91 75399 72026'), { status: 400 });
    next.care_number = p;
  }
  const { rows } = await pool.query("UPDATE stores SET whatsapp_settings = COALESCE(whatsapp_settings,'{}'::jsonb) || $2::jsonb, updated_at=NOW() WHERE id=$1 RETURNING store_name, whatsapp_number, whatsapp_settings", [storeId, JSON.stringify(next)]);
  return normalize(rows[0].whatsapp_settings, rows[0]);
}

// Links for one order: hand-off to customer care, and a message to the customer.
function linksFor(settings, order, store) {
  if (!settings || !settings.enabled) return { care_url: null, customer_url: null };
  return {
    care_url: waLink(settings.care_number, render(settings.care_template, order, store)),
    customer_url: waLink(order.customer_phone, render(settings.customer_template, order, store))
  };
}

const placeholderList = () => Object.entries(PLACEHOLDERS).map(([key, [label]]) => ({ key, label }));

module.exports = { PLACEHOLDERS, DEFAULTS, render, waLink, cleanPhone, loadSettings, saveSettings, linksFor, placeholderList, normalize, ensureColumn };
