// Shipping (v4.6 phase B): Ekart AWBs, tracking links and shipment lists.
// Ekart has no API access yet, so AWBs are booked on the Ekart portal and typed or scanned in here ("manual" mode).
// The API adapter below has the same shape the real integration will need; it stays switched off until credentials exist.
const pool = require('../db');
const { encrypt, decrypt } = require('./deployment-settings');

const MODES = ['manual', 'api'];
const DEFAULT_TRACKING = 'https://ekartlogistics.com/shipmenttrack/{awb}';
const AWB_RE = /^[A-Za-z0-9-]{6,32}$/;
const SHIP_STAGES = {
  ready: ['confirmed', 'processing'],
  shipped: ['shipped'],
  delivered: ['delivered'],
  all: ['confirmed', 'processing', 'shipped', 'delivered']
};

const badRequest = msg => Object.assign(new Error(msg), { status: 400 });

function defaults() {
  return {
    enabled: false,          // off until the merchant ticks "Enable Ekart shipping"
    mode: 'manual',
    courier_name: 'Ekart',
    tracking_url_template: DEFAULT_TRACKING,
    api: { base_url: '', client_id: '', merchant_code: '', api_key: '' }
  };
}

async function settingsFor(storeId, db = pool) {
  const { rows } = await db.query('SELECT shipping_settings FROM stores WHERE id=$1', [storeId]);
  const s = (rows[0] && rows[0].shipping_settings) || {};
  const d = defaults();
  return { ...d, ...s, api: { ...d.api, ...(s.api || {}) } };
}

/** Settings as the dashboard sees them: the API key is never sent back, only whether one is saved. */
function publicSettings(s) {
  const { api_key, ...api } = s.api || {};
  return { ...s, api: { ...api, has_api_key: !!api_key }, api_ready: ekartApi.ready(s), modes: MODES, default_tracking_url: DEFAULT_TRACKING };
}

async function saveSettings(storeId, body) {
  const s = await settingsFor(storeId);
  if (body.enabled !== undefined) s.enabled = !!body.enabled;
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) throw badRequest('Mode must be manual or api');
    s.mode = body.mode;
  }
  if (body.courier_name !== undefined) s.courier_name = String(body.courier_name).trim().slice(0, 40) || 'Ekart';
  if (body.tracking_url_template !== undefined) {
    const t = String(body.tracking_url_template).trim();
    if (t && (!/^https?:\/\//i.test(t) || !t.includes('{awb}'))) throw badRequest('Tracking link must start with https:// and contain {awb}');
    s.tracking_url_template = t || DEFAULT_TRACKING;
  }
  if (body.api) {
    for (const k of ['base_url', 'client_id', 'merchant_code']) if (body.api[k] !== undefined) s.api[k] = String(body.api[k]).trim().slice(0, 200);
    if (body.api.api_key) s.api.api_key = encrypt(String(body.api.api_key).trim());
    if (body.api.clear_api_key) s.api.api_key = '';
  }
  if (s.mode === 'api' && !ekartApi.ready(s)) throw badRequest('Ekart API mode needs the base URL, client ID and API key. Keep "Manual AWB" until Ekart gives API access.');
  await pool.query('UPDATE stores SET shipping_settings=$2::jsonb WHERE id=$1', [storeId, JSON.stringify(s)]);
  return s;
}

function trackingUrl(settings, awb) {
  if (!awb) return '';
  return (settings.tracking_url_template || DEFAULT_TRACKING).replace(/\{awb\}/g, encodeURIComponent(awb));
}

function cleanAwb(awb) {
  const v = String(awb || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!AWB_RE.test(v)) throw badRequest('AWB must be 6–32 letters, numbers or dashes');
  return v;
}

/** Save (or clear) the AWB of one order; the tracking link is built from the store's template. */
async function assignAwb(storeId, orderId, { awb, courier } = {}) {
  const s = await settingsFor(storeId);
  const value = awb === null || awb === '' ? null : cleanAwb(awb);
  if (value) {
    const { rows: dup } = await pool.query('SELECT order_number FROM orders WHERE store_id=$1 AND tracking_number=$2 AND id<>$3 LIMIT 1', [storeId, value, orderId]);
    if (dup.length) throw badRequest(`AWB ${value} is already on order ${dup[0].order_number}`);
  }
  const { rows } = await pool.query(
    `UPDATE orders SET tracking_number=$3, courier=$4, tracking_url=$5, updated_at=NOW() WHERE id=$1 AND store_id=$2 RETURNING *`,
    [orderId, storeId, value, value ? (String(courier || '').trim().slice(0, 40) || s.courier_name) : null, value ? trackingUrl(s, value) : null]
  );
  return rows[0] || null;
}

async function listShipments(storeId, { stage = 'ready', from, to } = {}) {
  const statuses = SHIP_STAGES[stage] || SHIP_STAGES.ready;
  const params = [storeId, statuses];
  let range = '';
  if (from && to) { params.push(from, to); range = "AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $3 AND $4"; }
  const { rows } = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.shipping_address, o.items, o.total_amount, o.payment_method,
            o.payment_status, o.status, o.tracking_number, o.courier, o.tracking_url, o.shipped_at, o.delivered_at, o.created_at
       FROM orders o WHERE o.store_id=$1 AND o.status = ANY($2) ${range}
      ORDER BY o.created_at ASC LIMIT 1000`, params);
  return rows;
}

// ── Ekart API adapter (not live yet) ──
// When Ekart issues API access: fill base_url/client_id/api_key in the dashboard, implement request() against their
// spec, and switch the mode to "api". Everything above (AWB, tracking link, labels, WhatsApp) already works with it.
const ekartApi = {
  ready(s) { return !!(s && s.api && s.api.base_url && s.api.client_id && s.api.api_key); },
  async request(s, method, path, body) {
    const r = await fetch(s.api.base_url.replace(/\/$/, '') + path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + decrypt(s.api.api_key), 'X-Client-Id': s.api.client_id },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.message || data.error || 'Ekart API error ' + r.status), { status: 502 });
    return data;
  },
  /** Book a shipment and return { awb }. Field names follow Ekart's forward-shipment API; confirm them against the spec they send. */
  async createShipment(s, order, store) {
    if (s.mode !== 'api' || !this.ready(s)) throw Object.assign(new Error('Ekart API is not connected yet. Book the AWB on the Ekart portal and enter or scan it here.'), { status: 501 });
    const a = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address || '{}') : (order.shipping_address || {});
    const data = await this.request(s, 'POST', '/shipments', {
      client_reference_id: order.order_number,
      merchant_code: s.api.merchant_code,
      payment_mode: order.payment_method === 'cod' ? 'COD' : 'PREPAID',
      cod_amount: order.payment_method === 'cod' ? Number(order.total_amount) : 0,
      consignee: { name: order.customer_name, phone: order.customer_phone, address: [a.line1 || a.address, a.line2].filter(Boolean).join(', '), city: a.city, state: a.state, pincode: a.pincode },
      pickup: { name: store.store_name, address: store.address, city: store.city, state: store.state }
    });
    return { awb: data.tracking_id || data.awb || data.awb_number };
  }
};

module.exports = { MODES, DEFAULT_TRACKING, SHIP_STAGES, defaults, settingsFor, publicSettings, saveSettings, trackingUrl, cleanAwb, assignAwb, listShipments, ekartApi };
