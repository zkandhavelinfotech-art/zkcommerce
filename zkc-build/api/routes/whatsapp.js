// WhatsApp sender settings (ZKWAConnect / Gupshup / one-click) and the message outbox.
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const waSender = require('../services/wa-sender');
const orderMessages = require('../services/order-messages');

async function storeFor(req) {
  const id = Number((req.body && req.body.store_id) || req.query.store_id || req.user.store_id);
  const admin = req.user.role === 'admin';
  const { rows } = Number.isSafeInteger(id) && id > 0
    ? await pool.query('SELECT id, store_name FROM stores WHERE id=$1 AND ($2::boolean OR merchant_id=$3)', [id, admin, req.user.id])
    : await pool.query('SELECT id, store_name FROM stores WHERE ($1::boolean OR merchant_id=$2) ORDER BY id LIMIT 1', [admin, req.user.id]);
  return rows[0] || null;
}
const fail = (res, e) => res.status(e.status || 500).json({ error: e.message });

router.get('/sender', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ sender: waSender.publicSender(await waSender.loadSender(store.id)) });
  } catch (e) { fail(res, e); }
});

router.put('/sender', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ sender: await waSender.saveSender(store.id, req.body || {}) });
  } catch (e) { fail(res, e); }
});

// Send a test message through the saved provider to a number the merchant enters.
router.post('/sender/test', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const to = orderMessages.cleanPhone(req.body.to);
    if (!to) return res.status(400).json({ error: 'Enter the WhatsApp number to test, with country code' });
    const r = await waSender.send(store.id, { kind: 'care_alert', to, text: `✅ Test message from ${store.store_name} (ZKCommerce WhatsApp sender).` });
    res.json(r);
  } catch (e) { fail(res, e); }
});

router.get('/outbox', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const messages = await waSender.outbox(store.id, { status: req.query.status, limit: req.query.limit });
    const { rows: [counts] } = await pool.query("SELECT COUNT(*) FILTER (WHERE status<>'sent')::int AS waiting, COUNT(*)::int AS total FROM whatsapp_outbox WHERE store_id=$1", [store.id]);
    res.json({ messages, counts });
  } catch (e) { fail(res, e); }
});

// After the merchant sends a queued message by hand (one-click wa.me link).
router.post('/outbox/:id/sent', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    if (!(await waSender.markSent(store.id, Number(req.params.id)))) return res.status(404).json({ error: 'Message not found' });
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

module.exports = router;
