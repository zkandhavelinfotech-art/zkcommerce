// Ekart shipping (v4.6 phase B): settings, shipment list, AWB entry and (later) API booking.
// Mounted at /api/shipments; marking shipped/delivered goes through PUT /api/orders/:id/status (WhatsApp + times).
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const shipping = require('../services/shipping');

async function storeFor(req) {
  const id = Number((req.body && req.body.store_id) || req.query.store_id || req.user.store_id);
  const admin = req.user.role === 'admin';
  const { rows } = Number.isSafeInteger(id) && id > 0
    ? await pool.query('SELECT id, store_name, address, city, state, whatsapp_number FROM stores WHERE id=$1 AND ($2::boolean OR merchant_id=$3)', [id, admin, req.user.id])
    : await pool.query('SELECT id, store_name, address, city, state, whatsapp_number FROM stores WHERE ($1::boolean OR merchant_id=$2) ORDER BY id LIMIT 1', [admin, req.user.id]);
  return rows[0] || null;
}
const fail = (res, e) => res.status(e.status || 500).json({ error: e.message });
const isoDate = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

router.get('/settings', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ settings: shipping.publicSettings(await shipping.settingsFor(store.id)) });
  } catch (e) { fail(res, e); }
});

router.put('/settings', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ settings: shipping.publicSettings(await shipping.saveSettings(store.id, req.body || {})) });
  } catch (e) { fail(res, e); }
});

router.get('/orders', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const settings = await shipping.settingsFor(store.id);
    const from = isoDate(req.query.from), to = isoDate(req.query.to);
    if (from && to && from > to) return res.status(400).json({ error: '"From" date must be on or before "To" date' });
    const orders = await shipping.listShipments(store.id, { stage: req.query.stage, from, to });
    res.json({ store, settings: shipping.publicSettings(settings), orders });
  } catch (e) { fail(res, e); }
});

// Save the AWB typed or scanned from the Ekart portal booking. Empty AWB clears it.
router.put('/orders/:id/awb', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const order = await shipping.assignAwb(store.id, Number(req.params.id), req.body || {});
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (e) { fail(res, e); }
});

// Book through the Ekart API (PUT /api/v1/package/create)
router.post('/orders/:id/book', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const { rows: [order] } = await pool.query('SELECT * FROM orders WHERE id=$1 AND store_id=$2', [Number(req.params.id), store.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const settings = await shipping.settingsFor(store.id);
    const { awb, tracking_id, barcodes, vendor } = await shipping.ekartApi.createShipment(settings, order, store);
    const updated = await shipping.assignAwb(store.id, order.id, { awb, courier: settings.courier_name });
    res.json({ success: true, order: updated, awb, tracking_id, barcodes, vendor });
  } catch (e) { fail(res, e); }
});

// Download Ekart label PDF
router.get('/orders/:id/label', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const { rows: [order] } = await pool.query('SELECT * FROM orders WHERE id=$1 AND store_id=$2', [Number(req.params.id), store.id]);
    if (!order || !order.tracking_number) return res.status(404).json({ error: 'Order or tracking number not found' });
    const settings = await shipping.settingsFor(store.id);
    const token = await shipping.ekartApi.getToken(settings);
    const base = shipping.ekartApi.normalizeBaseUrl(settings.api.base_url);
    const r = await fetch(`${base}/api/v1/package/label?json_only=false`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/octet-stream, application/pdf' },
      body: JSON.stringify({ ids: [order.tracking_number] }),
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) return res.status(502).json({ error: 'Ekart label download failed' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ekart-label-${order.tracking_number}.pdf"`);
    const buffer = Buffer.from(await r.arrayBuffer());
    res.send(buffer);
  } catch (e) { fail(res, e); }
});

module.exports = router;
