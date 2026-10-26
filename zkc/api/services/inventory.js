// Stock for products and their variants (100 ml / 200 ml …), stock movements, and low-stock detection.
//
// A product either has no variants (stock = products.quantity) or has variants stored in products.variants:
//   { id, label, size_value, size_unit, price, compare_price, sku, quantity, active }
// With variants, products.quantity is kept as the sum of active variant stock and in_stock = sum > 0.
const crypto = require('crypto');
const pool = require('../db');

const UNITS = ['ml', 'l', 'g', 'kg', 'pcs'];
const UNIT_LABEL = { ml: 'ml', l: 'L', g: 'g', kg: 'kg', pcs: 'pcs' };
const DEFAULT_THRESHOLD = 50;

const intOrNull = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Math.round(Number(v)));
const sizeLabel = (value, unit) => (value !== null && value !== undefined && value !== '' && unit ? `${Number(value)} ${UNIT_LABEL[unit] || unit}` : '');

function badRequest(message) { return Object.assign(new Error(message), { status: 400 }); }

/** Validate and normalise a variants array from the editor (ids are kept stable so orders keep pointing at them). */
function normalizeVariants(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(v => v && typeof v === 'object').map((v, i) => {
    const unit = v.size_unit ? String(v.size_unit).toLowerCase() : '';
    if (unit && !UNITS.includes(unit)) throw badRequest(`Variant ${i + 1}: unit must be one of ${UNITS.join(', ')}`);
    const value = v.size_value === '' || v.size_value === null || v.size_value === undefined ? null : Number(v.size_value);
    if (value !== null && !(value > 0)) throw badRequest(`Variant ${i + 1}: size must be a positive number`);
    const label = String(v.label || sizeLabel(value, unit) || '').trim().slice(0, 60);
    if (!label) throw badRequest(`Variant ${i + 1}: enter a label or a size (e.g. 100 ml)`);
    const price = intOrNull(v.price);
    if (price === null || price < 0) throw badRequest(`Variant "${label}": enter a price`);
    const quantity = Math.max(0, intOrNull(v.quantity) ?? 0);
    let id = /^[a-z0-9_-]{1,40}$/i.test(String(v.id || '')) ? String(v.id) : 'v' + crypto.randomBytes(4).toString('hex');
    while (seen.has(id)) id = 'v' + crypto.randomBytes(4).toString('hex');
    seen.add(id);
    const compare = intOrNull(v.compare_price);
    return {
      id, label, size_value: value, size_unit: unit || null,
      price, compare_price: compare && compare > price ? compare : null,
      sku: v.sku ? String(v.sku).trim().slice(0, 80) : null,
      quantity, active: v.active !== false
    };
  });
}

const activeVariants = p => (Array.isArray(p.variants) ? p.variants : []).filter(v => v && typeof v === 'object' && v.id && v.active !== false);
const hasVariants = p => activeVariants(p).length > 0;
const stockOf = p => (hasVariants(p) ? activeVariants(p).reduce((n, v) => n + (Number(v.quantity) || 0), 0) : Number(p.quantity ?? 0));

/** Fields to store on a product row for its variants: summed stock, in_stock, and the lowest variant price as the "from" price. */
function deriveFromVariants(variants, fallback = {}) {
  const active = variants.filter(v => v.active !== false);
  if (!active.length) return {};
  const cheapest = active.reduce((a, b) => (b.price < a.price ? b : a));
  return {
    quantity: active.reduce((n, v) => n + v.quantity, 0),
    in_stock: active.some(v => v.quantity > 0),
    price: cheapest.price,
    compare_price: cheapest.compare_price ?? fallback.compare_price ?? null
  };
}

async function settingsFor(storeId, db = pool) {
  const { rows } = await db.query('SELECT inventory_settings FROM stores WHERE id=$1', [storeId]);
  const s = (rows[0] && rows[0].inventory_settings) || {};
  return { low_stock_threshold: Number.isInteger(s.low_stock_threshold) && s.low_stock_threshold >= 0 ? s.low_stock_threshold : DEFAULT_THRESHOLD, alerts_enabled: s.alerts_enabled !== false };
}

async function saveSettings(storeId, body) {
  const next = {};
  if (body.low_stock_threshold !== undefined) {
    const t = intOrNull(body.low_stock_threshold);
    if (t === null || t < 0 || t > 100000) throw badRequest('Low-stock level must be a whole number from 0');
    next.low_stock_threshold = t;
  }
  if (body.alerts_enabled !== undefined) next.alerts_enabled = !!body.alerts_enabled;
  await pool.query("UPDATE stores SET inventory_settings = COALESCE(inventory_settings,'{}'::jsonb) || $2::jsonb WHERE id=$1", [storeId, JSON.stringify(next)]);
  return settingsFor(storeId);
}

const thresholdFor = (product, settings) => (Number.isInteger(product.low_stock_threshold) ? product.low_stock_threshold : settings.low_stock_threshold);

/**
 * Check that every cart line can be supplied (live stock, not the published snapshot).
 * Returns { product_id → row } for pricing; throws 409 with a shopper-readable message.
 */
async function checkAvailability(db, storeId, items) {
  const ids = [...new Set(items.map(i => Number(i.product_id)).filter(Boolean))];
  const { rows } = await db.query('SELECT id, name, quantity, variants, in_stock, active FROM products WHERE store_id=$1 AND id = ANY($2)', [storeId, ids]);
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  const need = new Map();
  for (const item of items) {
    const p = byId[Number(item.product_id)];
    if (!p || !p.active) throw Object.assign(new Error(`Product ${item.product_id} is not available`), { status: 400 });
    if (hasVariants(p) && !item.variant_id) throw Object.assign(new Error(`Choose a size for ${p.name}`), { status: 400 });
    const key = p.id + ':' + (item.variant_id || '');
    need.set(key, (need.get(key) || 0) + Number(item.quantity));
  }
  for (const [key, qty] of need) {
    const [pid, vid] = key.split(':');
    const p = byId[Number(pid)];
    if (vid) {
      const v = activeVariants(p).find(x => x.id === vid);
      if (!v) throw Object.assign(new Error(`That size of ${p.name} is no longer available`), { status: 409 });
      if (v.quantity < qty) throw Object.assign(new Error(v.quantity ? `Only ${v.quantity} left of ${p.name} (${v.label})` : `${p.name} (${v.label}) is out of stock`), { status: 409 });
    } else if (p.quantity !== null && p.quantity < qty) {
      throw Object.assign(new Error(p.quantity ? `Only ${p.quantity} left of ${p.name}` : `${p.name} is out of stock`), { status: 409 });
    }
  }
  return byId;
}

/**
 * Apply stock changes inside the caller's transaction (client). lines: [{ product_id, variant_id, quantity }]
 * sign -1 = sale, +1 = return to stock. Returns low-stock crossings for alerting.
 */
// allowNegative: a paid order is never refused — stock may go below 0 (shown as oversold on the inventory screen).
async function applyStock(client, storeId, lines, sign, { reason, orderId = null, allowNegative = false } = {}) {
  const settings = await settingsFor(storeId, client);
  const crossings = [];
  for (const line of lines) {
    const qty = Math.max(0, parseInt(line.quantity, 10) || 0);
    if (!qty) continue;
    const { rows: [p] } = await client.query('SELECT id, name, quantity, variants, low_stock_threshold FROM products WHERE id=$1 AND store_id=$2 FOR UPDATE', [line.product_id, storeId]);
    if (!p) continue;
    const threshold = thresholdFor(p, settings);
    let before, after;
    if (line.variant_id && hasVariants(p)) {
      const variants = p.variants.map(v => ({ ...v }));
      const v = variants.find(x => x.id === line.variant_id);
      if (!v) continue;
      before = Number(v.quantity) || 0;
      if (sign < 0 && before < qty && !allowNegative) throw Object.assign(new Error(`Only ${before} left of ${p.name} (${v.label})`), { status: 409 });
      v.quantity = after = before + sign * qty;
      const d = deriveFromVariants(variants);
      await client.query('UPDATE products SET variants=$3::jsonb, quantity=$4, in_stock=$5, updated_at=NOW() WHERE id=$1 AND store_id=$2', [p.id, storeId, JSON.stringify(variants), d.quantity, d.in_stock]);
      if (sign < 0 && before > threshold && after <= threshold) crossings.push({ product_id: p.id, name: p.name, variant_id: v.id, variant: v.label, quantity: after, threshold });
    } else {
      before = Number(p.quantity) || 0;
      if (sign < 0 && before < qty && !allowNegative) throw Object.assign(new Error(`Only ${before} left of ${p.name}`), { status: 409 });
      after = before + sign * qty;
      await client.query('UPDATE products SET quantity=$3, in_stock=$4, updated_at=NOW() WHERE id=$1 AND store_id=$2', [p.id, storeId, after, after > 0]);
      if (sign < 0 && before > threshold && after <= threshold) crossings.push({ product_id: p.id, name: p.name, variant_id: null, variant: null, quantity: after, threshold });
    }
    await client.query('INSERT INTO inventory_movements (store_id, product_id, variant_id, change, quantity_after, reason, order_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [storeId, p.id, line.variant_id || null, sign * qty, after, reason, orderId]);
  }
  return crossings;
}

/** Order line items → stock lines. Works for orders.items (Node) whose entries carry id/product_id, variant_id, quantity. */
const linesFromOrderItems = items => (Array.isArray(items) ? items : []).map(i => ({ product_id: i.product_id || i.id, variant_id: i.variant_id || null, quantity: i.quantity }));

/** Take stock for a confirmed/paid order exactly once (orders.stock_deducted guards double counting). */
async function deductForOrder(client, orderId, { allowNegative = false } = {}) {
  const { rows: [o] } = await client.query('SELECT id, store_id, items, stock_deducted FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
  if (!o || o.stock_deducted) return [];
  const crossings = await applyStock(client, o.store_id, linesFromOrderItems(o.items), -1, { reason: 'sale', orderId: o.id, allowNegative });
  await client.query('UPDATE orders SET stock_deducted=true WHERE id=$1', [o.id]);
  return crossings;
}

/** Put stock back when a deducted order is cancelled. */
async function restockForOrder(client, orderId) {
  const { rows: [o] } = await client.query('SELECT id, store_id, items, stock_deducted FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
  if (!o || !o.stock_deducted) return false;
  await applyStock(client, o.store_id, linesFromOrderItems(o.items), +1, { reason: 'cancel', orderId: o.id });
  await client.query('UPDATE orders SET stock_deducted=false WHERE id=$1', [o.id]);
  return true;
}

/** Manual adjustment from the inventory screen: set an absolute quantity for a product or one of its variants. */
async function setStock(storeId, productId, variantId, quantity, note) {
  const target = intOrNull(quantity);
  if (target === null || target < 0) throw badRequest('Quantity must be a whole number from 0');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [p] } = await client.query('SELECT id, quantity, variants FROM products WHERE id=$1 AND store_id=$2 FOR UPDATE', [productId, storeId]);
    if (!p) { await client.query('ROLLBACK'); return null; }
    let before;
    if (variantId) {
      const variants = (p.variants || []).map(v => ({ ...v }));
      const v = variants.find(x => x.id === variantId);
      if (!v) { await client.query('ROLLBACK'); throw badRequest('Variant not found'); }
      before = Number(v.quantity) || 0;
      v.quantity = target;
      const d = deriveFromVariants(variants);
      await client.query('UPDATE products SET variants=$3::jsonb, quantity=$4, in_stock=$5, updated_at=NOW() WHERE id=$1 AND store_id=$2', [p.id, storeId, JSON.stringify(variants), d.quantity ?? target, d.in_stock ?? target > 0]);
    } else {
      before = Number(p.quantity) || 0;
      await client.query('UPDATE products SET quantity=$3, in_stock=$4, updated_at=NOW() WHERE id=$1 AND store_id=$2', [p.id, storeId, target, target > 0]);
    }
    if (target !== before) {
      await client.query('INSERT INTO inventory_movements (store_id, product_id, variant_id, change, quantity_after, reason, note) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [storeId, p.id, variantId || null, target - before, target, before === 0 && target > 0 && !variantId ? 'restock' : 'adjust', note ? String(note).slice(0, 200) : null]);
    }
    await client.query('COMMIT');
    return { before, after: target };
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  finally { client.release(); }
}

/** Inventory overview: one row per product, or per variant when the product has variants. */
async function overview(storeId) {
  const settings = await settingsFor(storeId);
  const { rows } = await pool.query(`SELECT p.id, p.name, p.sku, p.quantity, p.variants, p.active, p.in_stock, p.low_stock_threshold,
      p.net_quantity_value, p.net_quantity_unit, p.product_size, c.name AS category_name,
      (SELECT MAX(created_at) FROM inventory_movements m WHERE m.product_id = p.id) AS last_movement
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.store_id=$1 ORDER BY p.active DESC, p.name`, [storeId]);
  const items = [];
  for (const p of rows) {
    const threshold = thresholdFor(p, settings);
    const net = sizeLabel(p.net_quantity_value, p.net_quantity_unit) || p.product_size || '';
    const base = { product_id: p.id, name: p.name, category_name: p.category_name, active: p.active, threshold, last_movement: p.last_movement };
    if (hasVariants(p)) for (const v of activeVariants(p)) items.push({ ...base, variant_id: v.id, variant: v.label, sku: v.sku || p.sku, quantity: Number(v.quantity) || 0, size: sizeLabel(v.size_value, v.size_unit) || v.label, low: (Number(v.quantity) || 0) <= threshold });
    else items.push({ ...base, variant_id: null, variant: null, sku: p.sku, quantity: Number(p.quantity) || 0, size: net, low: (Number(p.quantity) || 0) <= threshold });
  }
  return { settings, items, low_count: items.filter(i => i.active && i.low).length };
}

module.exports = {
  UNITS, UNIT_LABEL, DEFAULT_THRESHOLD, sizeLabel, normalizeVariants, activeVariants, hasVariants, stockOf, deriveFromVariants,
  settingsFor, saveSettings, checkAvailability, applyStock, deductForOrder, restockForOrder, setStock, overview, linesFromOrderItems
};
