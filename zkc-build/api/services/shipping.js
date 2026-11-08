// Shipping (v4.6 phase B): Ekart AWBs, tracking links and shipment lists.
// Ekart has no API access yet, so AWBs are booked on the Ekart portal and typed or scanned in here ("manual" mode).
// The API adapter below has the same shape the real integration will need; it stays switched off until credentials exist.
const pool = require('../db');
const { encrypt, decrypt } = require('./deployment-settings');

const MODES = ['manual', 'api'];
const DEFAULT_TRACKING = 'https://app.elite.ekartlogistics.in/track/{awb}';
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
    enabled: true,
    mode: 'api',
    courier_name: 'Ekart Logistics',
    tracking_url_template: DEFAULT_TRACKING,
    api: {
      base_url: 'https://app.elite.ekartlogistics.in',
      client_id: 'EKART_6ad49aef2206ede3ee46d222',
      merchant_code: 'SMERAMx',
      api_key: '',
      username: 'EKART_6ad49aef2206ede3ee46d222',
      password: ''
    }
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

// ── Ekart API adapter (OpenAPI 3.1.0 Spec Aligned) ──
const ekartApi = {
  ready(s) {
    return !!(s && s.api && (s.api.api_key || s.api.password || s.api.client_id));
  },
  normalizeBaseUrl(url) {
    const u = String(url || 'https://app.elite.ekartlogistics.in').trim().replace(/\/api\/?$/i, '');
    return u.replace(/\/$/, '');
  },
  async getToken(s) {
    const apiKey = s.api.api_key ? decrypt(s.api.api_key) : '';
    const username = s.api.username || s.api.client_id || 'EKART_6ad49aef2206ede3ee46d222';
    const password = s.api.password || apiKey || '';
    if (apiKey && (!username || !password)) return apiKey;
    const base = this.normalizeBaseUrl(s.api.base_url);
    const clientId = s.api.client_id || 'EKART_6ad49aef2206ede3ee46d222';
    try {
      const r = await fetch(`${base}/integrations/v2/auth/token/${encodeURIComponent(clientId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.access_token) return data.access_token;
      if (apiKey) return apiKey;
      throw new Error(data.remark || data.message || data.error || `HTTP ${r.status}`);
    } catch (e) {
      if (apiKey) return apiKey;
      throw e;
    }
  },
  /** Book a forward shipment via PUT /api/v1/package/create matching Ekart OpenAPI 3.1 spec */
  async createShipment(s, order, store) {
    if (s.mode !== 'api') throw Object.assign(new Error('Ekart API mode is not enabled.'), { status: 400 });
    const token = await this.getToken(s);
    const base = this.normalizeBaseUrl(s.api.base_url);

    const a = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address || '{}') : (order.shipping_address || {});
    const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
    const qty = items.reduce((sum, it) => sum + Math.max(1, Number(it.quantity) || 1), 0) || 1;
    const desc = items.map(it => `${it.name || 'Product'} (x${Math.max(1, Number(it.quantity) || 1)})`).join(', ').slice(0, 200) || 'General Goods';

    const total = Number(order.total_amount) || 0;
    const gst = Number(order.gst_amount) || 0;
    const taxable = Math.max(1, Math.round((total - gst) * 100) / 100);
    const isCod = order.payment_method === 'cod';

    const custPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10) || '9876543210';
    const custPin = String(order.pincode || a.pincode || '641001').replace(/\D/g, '').slice(0, 6) || '641001';
    const storePin = String(store.pincode || '641002').replace(/\D/g, '').slice(0, 6) || '641002';
    const storePhone = String(store.whatsapp_number || '9840012345').replace(/\D/g, '').slice(-10) || '9840012345';

    const payload = {
      seller_name: store.store_name || 'Smeram Industries',
      seller_address: store.address || '61-A, V.C.V Layout, RS Puram',
      seller_gst_tin: store.gst_number || '33DVRPR1801M1Z6',
      seller_gst_amount: gst,
      consignee_gst_amount: 0,
      integrated_gst_amount: 0,
      order_number: order.order_number,
      invoice_number: order.invoice_number || order.order_number,
      invoice_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 10),
      consignee_name: order.customer_name || 'Customer',
      consignee_alternate_phone: custPhone,
      products_desc: desc,
      payment_mode: isCod ? 'COD' : 'Prepaid',
      category_of_goods: 'Personal Care & Cosmetics',
      total_amount: Math.max(1, total),
      tax_value: gst,
      taxable_amount: taxable,
      commodity_value: taxable.toFixed(2),
      cod_amount: isCod ? total : 0,
      quantity: qty,
      weight: 500,
      length: 15,
      height: 10,
      width: 10,
      return_reason: '',
      service: 'SURFACE',
      drop_location: {
        name: order.customer_name || 'Customer',
        address: [a.line1 || a.address || order.shipping_address, a.line2].filter(Boolean).join(', ') || 'Customer Address',
        pin: Number(custPin),
        phone: Number(custPhone),
        city: a.city || order.city || 'Coimbatore',
        state: a.state || order.state || 'Tamil Nadu',
        country: 'India',
        location_type: 'Home'
      },
      pickup_location: {
        name: store.store_name || 'Smeram Industries',
        address: store.address || '61-A, V.C.V Layout, RS Puram',
        pin: Number(storePin),
        phone: Number(storePhone),
        city: store.city || 'Coimbatore',
        state: store.state || 'Tamil Nadu',
        country: 'India',
        location_type: 'Office'
      },
      return_location: {
        name: store.store_name || 'Smeram Industries',
        address: store.address || '61-A, V.C.V Layout, RS Puram',
        pin: Number(storePin),
        phone: Number(storePhone),
        city: store.city || 'Coimbatore',
        state: store.state || 'Tamil Nadu',
        country: 'India',
        location_type: 'Office'
      }
    };

    const r = await fetch(`${base}/api/v1/package/create`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.status === false) {
      throw Object.assign(new Error(data.remark || data.message || data.error || `Ekart create failed (${r.status})`), { status: 502 });
    }
    const awb = data.tracking_id || data.barcodes?.wbn;
    return { awb, tracking_id: data.tracking_id, barcodes: data.barcodes, vendor: data.vendor };
  }
};

module.exports = { MODES, DEFAULT_TRACKING, SHIP_STAGES, defaults, settingsFor, publicSettings, saveSettings, trackingUrl, cleanAwb, assignAwb, listShipments, ekartApi };
