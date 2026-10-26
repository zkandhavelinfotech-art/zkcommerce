// Sends WhatsApp messages through the store's chosen provider and records every message in whatsapp_outbox.
//
// Providers (one active per store, Store Builder → Settings → WhatsApp sender):
//   zkwaconnect — your ZKWAConnect workspace (official Meta Cloud API): POST {base_url}/api/v1/messages
//   gupshup     — Gupshup BSP (paid per message on top of Meta's charge)
//   none        — nothing is sent automatically; messages wait in the outbox for a one-click send
//
// WhatsApp only allows free text inside 24 h of the customer's last message. Business-initiated messages
// (order confirmations, alerts) therefore need a Meta-approved template: set its name and the fields that
// fill {{1}}, {{2}}, … for each message kind. Without a template the text is tried and, if refused, queued.
const pool = require('../db');
const orderMessages = require('./order-messages');
const { encrypt, decrypt } = require('./deployment-settings');

const PROVIDERS = ['zkwaconnect', 'gupshup', 'none'];
const KINDS = {
  order_confirmation: 'Order confirmation to the customer',
  care_alert: 'New order alert to customer care',
  low_stock: 'Low-stock alert to the merchant',
  order_shipped: 'Shipped / tracking update to the customer',
  order_delivered: 'Delivered update to the customer'
};

function defaults() {
  return {
    provider: 'zkwaconnect',
    zkwaconnect: { base_url: '', api_key: '', phone_number_id: '' },
    gupshup: { app_name: '', source_number: '', api_key: '' },
    templates: Object.fromEntries(Object.keys(KINDS).map(k => [k, { name: '', language: 'en', variables: '' }])),
    auto: { order_confirmation: true, care_alert: true, low_stock: true, order_shipped: true, order_delivered: true }
  };
}

const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  return out;
};

async function loadSender(storeId) {
  const { rows } = await pool.query('SELECT whatsapp_settings FROM stores WHERE id=$1', [storeId]);
  return merge(defaults(), ((rows[0] && rows[0].whatsapp_settings) || {}).sender || {});
}

/** Browser-safe view: API keys replaced with has_key flags. */
function publicSender(s) {
  return {
    ...s,
    zkwaconnect: { ...s.zkwaconnect, api_key: undefined, has_key: !!s.zkwaconnect.api_key },
    gupshup: { ...s.gupshup, api_key: undefined, has_key: !!s.gupshup.api_key || !!process.env.GUPSHUP_API_KEY, uses_env_key: !s.gupshup.api_key && !!process.env.GUPSHUP_API_KEY },
    kinds: KINDS
  };
}

async function saveSender(storeId, body) {
  const current = await loadSender(storeId);
  const next = merge(current, {});
  if (body.provider !== undefined) {
    if (!PROVIDERS.includes(body.provider)) throw Object.assign(new Error('Provider must be zkwaconnect, gupshup or none'), { status: 400 });
    next.provider = body.provider;
  }
  if (body.zkwaconnect) {
    const z = body.zkwaconnect;
    if (z.base_url !== undefined) {
      const url = String(z.base_url).trim().replace(/\/+$/, '');
      if (url && !/^https?:\/\/[^\s/]+/.test(url)) throw Object.assign(new Error('ZKWAConnect URL must start with https://'), { status: 400 });
      next.zkwaconnect.base_url = url;
    }
    if (z.phone_number_id !== undefined) next.zkwaconnect.phone_number_id = String(z.phone_number_id).trim();
    if (z.api_key) next.zkwaconnect.api_key = encrypt(String(z.api_key).trim());
  }
  if (body.gupshup) {
    const g = body.gupshup;
    for (const k of ['app_name', 'source_number']) if (g[k] !== undefined) next.gupshup[k] = String(g[k]).trim();
    if (g.api_key) next.gupshup.api_key = encrypt(String(g.api_key).trim());
  }
  if (body.templates) for (const k of Object.keys(KINDS)) {
    const t = body.templates[k];
    if (!t) continue;
    next.templates[k] = {
      name: String(t.name || '').trim().slice(0, 120),
      language: String(t.language || 'en').trim().slice(0, 12) || 'en',
      variables: String(t.variables || '').slice(0, 500)
    };
  }
  if (body.auto) for (const k of Object.keys(KINDS)) if (body.auto[k] !== undefined) next.auto[k] = !!body.auto[k];
  await pool.query("UPDATE stores SET whatsapp_settings = jsonb_set(COALESCE(whatsapp_settings,'{}'::jsonb), '{sender}', $2::jsonb, true), updated_at=NOW() WHERE id=$1", [storeId, JSON.stringify(next)]);
  return publicSender(next);
}

// ── Provider calls ──
async function postJson(url, headers, body, timeoutMs = 15000) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function sendZkwaconnect(cfg, to, text, template, variables) {
  const key = decrypt(cfg.api_key);
  if (!cfg.base_url || !key) return { ok: false, error: 'ZKWAConnect URL or API key is not set' };
  const body = template
    ? { to, type: 'template', template: { name: template.name, language: template.language || undefined, variables } }
    : { to, type: 'text', text: { body: text } };
  if (cfg.phone_number_id) body.phone_number_id = cfg.phone_number_id;
  const r = await postJson(cfg.base_url + '/api/v1/messages', { Authorization: 'Bearer ' + key }, body);
  if (r.ok) return { ok: true, id: r.data.whatsapp_message_id || r.data.id };
  return { ok: false, error: (r.data.error && (r.data.error.message || r.data.error.code)) || 'HTTP ' + r.status, code: r.data.error && r.data.error.code };
}

async function sendGupshup(cfg, to, text, template, variables) {
  const key = decrypt(cfg.api_key) || process.env.GUPSHUP_API_KEY;
  const source = cfg.source_number || process.env.GUPSHUP_SOURCE_NUMBER;
  if (!key || !source) return { ok: false, error: 'Gupshup API key or source number is not set' };
  const form = new URLSearchParams({ channel: 'whatsapp', source, destination: to, 'src.name': cfg.app_name || process.env.GUPSHUP_APP_NAME || 'ZKCommerce' });
  let url = 'https://api.gupshup.io/wa/api/v1/msg';
  if (template) { url = 'https://api.gupshup.io/wa/api/v1/template/msg'; form.set('template', JSON.stringify({ id: template.name, params: variables })); }
  else form.set('message', JSON.stringify({ type: 'text', text }));
  const r = await fetch(url, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(15000) });
  const data = await r.json().catch(() => ({}));
  if (r.ok && data.status !== 'error') return { ok: true, id: data.messageId };
  return { ok: false, error: data.message || 'HTTP ' + r.status };
}

/**
 * Send one message and record it. Returns { status: 'sent' | 'pending' | 'failed', wa_link, error }.
 * kind: a KINDS key; text: the full rendered message; values: field values used for template variables.
 */
async function send(storeId, { kind, to, text, order = null, store = {}, extra = {}, orderId = null, productId = null }) {
  const phone = orderMessages.cleanPhone(to);
  if (!phone) return { status: 'failed', error: 'No valid WhatsApp number' };
  const s = await loadSender(storeId);
  const template = s.templates[kind] && s.templates[kind].name ? s.templates[kind] : null;
  const variables = template && template.variables
    ? template.variables.split('|').map(v => orderMessages.render(v.trim(), order, store, extra) || '-')
    : [];
  let result = { ok: false, error: 'Automatic sending is off (provider: none)' };
  if (s.auto[kind] !== false && s.provider === 'zkwaconnect') result = await sendZkwaconnect(s.zkwaconnect, phone, text, template, variables).catch(e => ({ ok: false, error: e.message }));
  else if (s.auto[kind] !== false && s.provider === 'gupshup') result = await sendGupshup(s.gupshup, phone, text, template, variables).catch(e => ({ ok: false, error: e.message }));
  else if (s.auto[kind] === false) result = { ok: false, error: 'Automatic sending is off for this message type' };
  const status = result.ok ? 'sent' : s.provider === 'none' || s.auto[kind] === false ? 'pending' : 'failed';
  const error = result.ok ? null : result.code === 'window_closed' ? 'Needs an approved template (customer has not messaged in 24 h). Set one in WhatsApp sender settings.' : result.error;
  const { rows: [row] } = await pool.query(
    'INSERT INTO whatsapp_outbox (store_id, kind, to_phone, message, provider, status, error, order_id, product_id, sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
    [storeId, kind, phone, text, s.provider, status, error, orderId, productId, result.ok ? new Date() : null]
  );
  if (!result.ok) console.warn(`[WhatsApp] ${kind} to +${phone} not sent automatically (${s.provider}): ${error}`);
  return { id: row.id, status, error, wa_link: orderMessages.waLink(phone, text) };
}

// ── Business events ──

/** New confirmed/paid order: confirmation to the customer + alert to customer care. Never throws. */
async function notifyOrderConfirmed(storeId, order, store) {
  try {
    const wa = await orderMessages.loadSettings(storeId);
    if (!wa || !wa.enabled) return [];
    const out = [];
    if (order.customer_phone) out.push(await send(storeId, { kind: 'order_confirmation', to: order.customer_phone, text: orderMessages.render(wa.customer_template, order, store), order, store, orderId: order.id }));
    if (wa.care_number) out.push(await send(storeId, { kind: 'care_alert', to: wa.care_number, text: orderMessages.render(wa.care_template, order, store), order, store, orderId: order.id }));
    return out;
  } catch (e) { console.warn('[WhatsApp] order notification error:', e.message); return []; }
}

/** Order marked shipped or delivered: tell the customer (tracking link in the shipped message). Never throws. */
async function notifyShipment(storeId, order, store, stage) {
  try {
    const wa = await orderMessages.loadSettings(storeId);
    if (!wa || !wa.enabled || !order.customer_phone) return [];
    const kind = stage === 'delivered' ? 'order_delivered' : 'order_shipped';
    const tpl = stage === 'delivered' ? wa.delivered_template : wa.shipped_template;
    return [await send(storeId, { kind, to: order.customer_phone, text: orderMessages.render(tpl, order, store), order, store, orderId: order.id })];
  } catch (e) { console.warn('[WhatsApp] shipment update error:', e.message); return []; }
}

/** Stock fell to/below the threshold: alert the merchant's customer-care number. Never throws. */
async function notifyLowStock(storeId, crossings) {
  if (!crossings || !crossings.length) return [];
  try {
    const [wa, inv] = await Promise.all([orderMessages.loadSettings(storeId), require('./inventory').settingsFor(storeId)]);
    if (!wa || !wa.care_number || !inv.alerts_enabled) return [];
    const { rows: [store] } = await pool.query('SELECT store_name FROM stores WHERE id=$1', [storeId]);
    const out = [];
    for (const c of crossings) {
      const extra = { product_name: c.name, variant: c.variant || '', stock_left: String(c.quantity), threshold: String(c.threshold) };
      out.push(await send(storeId, { kind: 'low_stock', to: wa.care_number, text: orderMessages.render(wa.low_stock_template, null, store, extra), store, extra, productId: c.product_id }));
    }
    return out;
  } catch (e) { console.warn('[WhatsApp] low-stock alert error:', e.message); return []; }
}

async function outbox(storeId, { status, limit = 100 } = {}) {
  const params = [storeId];
  let where = 'store_id=$1';
  if (status) { params.push(status); where += ' AND status=$2'; }
  const { rows } = await pool.query(`SELECT * FROM whatsapp_outbox WHERE ${where} ORDER BY created_at DESC LIMIT ${Math.min(500, Number(limit) || 100)}`, params);
  return rows.map(r => ({ ...r, wa_link: orderMessages.waLink(r.to_phone, r.message) }));
}

async function markSent(storeId, id) {
  const { rowCount } = await pool.query("UPDATE whatsapp_outbox SET status='sent', provider=COALESCE(provider,'manual'), sent_at=NOW(), error=NULL WHERE id=$1 AND store_id=$2", [id, storeId]);
  return rowCount > 0;
}

module.exports = { PROVIDERS, KINDS, loadSender, publicSender, saveSender, send, notifyOrderConfirmed, notifyShipment, notifyLowStock, outbox, markSent };
