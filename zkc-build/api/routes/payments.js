const router = require('express').Router();
const pool = require('../db');
const crypto = require('crypto');

function getRazorpayConfig() {
  const mode = (process.env.RAZORPAY_MODE || 'live').toLowerCase();
  const key_id = mode === 'test'
    ? (process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID)
    : (process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID);
  const key_secret = mode === 'test'
    ? (process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET)
    : (process.env.RAZORPAY_LIVE_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET);
  const webhook_secret = mode === 'test'
    ? (process.env.RAZORPAY_TEST_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET)
    : (process.env.RAZORPAY_LIVE_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET);
  return { mode, key_id, key_secret, webhook_secret };
}

function getRazorpay() {
  const cfg = getRazorpayConfig();
  if (!cfg.key_id || !cfg.key_secret) throw new Error('Razorpay is not configured');
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}
/**
 * Runs once when an order becomes paid (from /verify or the webhook, whichever flips it first):
 * takes stock, sends the WhatsApp confirmation / care alert, auto-generates the invoice for
 * Invoices & GST Tax Filing page, and sends low-stock alerts. Never throws.
 */
async function afterPaid(order) {
  let whatsappHandoffUrl = null;
  try {
    const orderMessages = require('../services/order-messages');
    const inventory = require('../services/inventory');
    const waSender = require('../services/wa-sender');
    const client = await pool.connect();
    let lowStock = [];
    try {
      await client.query('BEGIN');
      lowStock = await inventory.deductForOrder(client, order.id, { allowNegative: true });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); console.warn('[Payment] stock update failed:', e.message); }
    finally { client.release(); }
    const { rows: storeRows } = await pool.query('SELECT * FROM stores WHERE id=$1', [order.store_id]);
    const store = storeRows[0] || {};
    const lineItems = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items;
    const full = { ...order, items: lineItems };

    // Auto-generate invoice immediately for Invoices & GST Tax Filing
    try {
      const invNumber = `ZK-${order.store_id}-${order.id}`;
      await pool.query(
        'INSERT INTO invoices(store_id, order_id, invoice_number) VALUES($1, $2, $3) ON CONFLICT (order_id) DO NOTHING',
        [order.store_id, order.id, invNumber]
      );
    } catch (invErr) {
      console.warn('[Payment] auto invoice creation error:', invErr.message);
    }

    const waSettings = await orderMessages.loadSettings(order.store_id);
    if (waSettings && waSettings.customer_handoff) whatsappHandoffUrl = orderMessages.linksFor(waSettings, full, store).care_url;
    waSender.notifyOrderConfirmed(order.store_id, full, store);
    waSender.notifyLowStock(order.store_id, lowStock);
  } catch (e) { console.warn('[Payment] after-paid steps failed:', e.message); }
  return { whatsappHandoffUrl };
}

// Razorpay SDK errors carry { statusCode, error: { description } } and no message.
function rzpError(e) {
  const d = e && e.error && (e.error.description || e.error.code);
  if (d) return 'Razorpay: ' + d + (e.statusCode === 401 ? ' (check the Razorpay key id / secret)' : '');
  return (e && e.message) || 'Razorpay request failed';
}

function safeEqualHex(actual, expected) {
  if (!/^[a-f0-9]{64}$/i.test(String(actual || '')) || !/^[a-f0-9]{64}$/i.test(String(expected || ''))) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

// Create a provider order only for a still-pending ZKCommerce order.
router.post('/razorpay/order', async (req, res) => {
  let orderId;
  try {
    orderId = Number(req.body.order_id);
    if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'A valid order_id is required' });
    const { rows } = await pool.query("SELECT id,total_amount,payment_status,status FROM orders WHERE id=$1 AND payment_method='razorpay'", [orderId]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    if (rows[0].status !== 'pending' || rows[0].payment_status !== 'unpaid') return res.status(409).json({ error: 'This payment attempt has already started or ended. Create a new checkout attempt to retry.' });
    const claimed = await pool.query("UPDATE orders SET payment_status='processing' WHERE id=$1 AND status='pending' AND payment_status='unpaid' RETURNING id", [orderId]);
    if (!claimed.rows.length) return res.status(409).json({ error: 'A payment attempt is already in progress' });
    const rzpOrder = await getRazorpay().orders.create({
      amount: Number(rows[0].total_amount) * 100, currency: 'INR', receipt: `ZK${orderId}`,
      notes: { zkcommerce_order_id: String(orderId) }
    });
    await pool.query("UPDATE orders SET razorpay_order_id=$1,payment_failure=NULL WHERE id=$2 AND payment_status='processing'", [rzpOrder.id, orderId]);
    res.json({ razorpay_order_id: rzpOrder.id, amount: rzpOrder.amount, currency: 'INR', key: getRazorpayConfig().key_id });
  } catch (e) {
    try {
      const { rows } = await pool.query("UPDATE orders SET payment_status='failed',payment_failure=$1,updated_at=NOW() WHERE id=$2 AND payment_status='processing' AND payment_method='razorpay' RETURNING store_id,coupon_code", [rzpError(e).slice(0,500), orderId]);
      if (rows[0]?.coupon_code) await pool.query('UPDATE coupons SET used_count=GREATEST(0,used_count-1) WHERE store_id=$1 AND upper(code)=upper($2)', [rows[0].store_id, rows[0].coupon_code]);
    } catch (_) {}
    res.status(503).json({ error: rzpError(e) });
  }
});

router.post('/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    const keySecret = getRazorpayConfig().key_secret;
    if (!razorpay_order_id || !razorpay_payment_id || !order_id || !keySecret) return res.status(400).json({ error: 'Payment verification details are incomplete' });
    const expected = crypto.createHmac('sha256', keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!safeEqualHex(razorpay_signature, expected)) return res.status(400).json({ error: 'Invalid payment signature' });
    const orderCheck = await pool.query("SELECT total_amount FROM orders WHERE id=$1 AND razorpay_order_id=$2 AND payment_method='razorpay'", [order_id, razorpay_order_id]);
    if (!orderCheck.rows.length) return res.status(404).json({ error: 'Pending order not found for this payment' });
    const payment = await getRazorpay().payments.fetch(razorpay_payment_id);
    if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== Number(orderCheck.rows[0].total_amount) * 100 || payment.currency !== 'INR') return res.status(400).json({ error: 'Payment does not match the order amount' });
    if (payment.status !== 'captured') return res.status(409).json({ error: 'Payment is not captured yet. Please retry or contact the merchant.' });
    const { rows } = await pool.query(`UPDATE orders SET status='confirmed',payment_status='paid',payment_failure=NULL,
      razorpay_payment_id=$1,razorpay_signature=$2,paid_at=COALESCE(paid_at,NOW()),updated_at=NOW()
      WHERE id=$3 AND razorpay_order_id=$4 AND payment_method='razorpay' AND status='pending' RETURNING *`,
      [razorpay_payment_id, razorpay_signature, order_id, razorpay_order_id]);
    if (!rows.length) {
      const existing = await pool.query("SELECT id,payment_status FROM orders WHERE id=$1 AND razorpay_order_id=$2", [order_id, razorpay_order_id]);
      if (existing.rows[0]?.payment_status === 'paid') return res.json({ message: 'Payment already verified', order_id: Number(order_id) });
      return res.status(404).json({ error: 'Pending order not found for this payment' });
    }
    const { whatsappHandoffUrl } = await afterPaid(rows[0]);
    res.json({ message: 'Payment verified', order_id: Number(order_id), whatsapp_handoff_url: whatsappHandoffUrl });
  } catch (e) { res.status(503).json({ error: rzpError(e) }); }
});

// Release a coupon reservation once after a failed attempt so a customer can retry.
router.post('/razorpay/failure', async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id, razorpay_order_id, reason } = req.body;
    await client.query('BEGIN');
    const { rows } = await client.query(`UPDATE orders SET payment_status='failed',payment_failure=$1,updated_at=NOW()
      WHERE id=$2 AND razorpay_order_id=$3 AND payment_method='razorpay' AND status='pending' AND payment_status='processing'
      RETURNING store_id,coupon_code`, [String(reason || 'Payment failed').slice(0, 500), order_id, razorpay_order_id]);
    if (rows[0]?.coupon_code) await client.query('UPDATE coupons SET used_count=GREATEST(0,used_count-1) WHERE store_id=$1 AND upper(code)=upper($2)', [rows[0].store_id, rows[0].coupon_code]);
    await client.query('COMMIT');
    res.json({ recorded: Boolean(rows.length), retryable: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/razorpay/webhook', async (req, res) => {
  try {
    const secret = getRazorpayConfig().webhook_secret;
    if (!secret) return res.status(503).json({ error: 'Razorpay webhook secret is not configured' });
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
    if (!safeEqualHex(signature, expected)) return res.status(400).json({ error: 'Invalid webhook signature' });
    const event = req.body, payment = event?.payload?.payment?.entity;
    if (event.event === 'payment.captured' && payment?.order_id) {
      // Covers shoppers who closed the tab before /verify ran. Only the request that flips the order runs afterPaid.
      const { rows } = await pool.query(`UPDATE orders SET status='confirmed',payment_status='paid',razorpay_payment_id=$1,paid_at=COALESCE(paid_at,NOW()),updated_at=NOW()
        WHERE razorpay_order_id=$2 AND status='pending' RETURNING *`, [payment.id, payment.order_id]);
      if (rows.length) await afterPaid(rows[0]);
    } else if (event.event === 'payment.failed' && payment?.order_id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`UPDATE orders SET payment_status='failed',payment_failure=$1,updated_at=NOW()
          WHERE razorpay_order_id=$2 AND payment_status='processing' AND status='pending' RETURNING store_id,coupon_code`,
          [String(payment.error_description || 'Payment failed').slice(0, 500), payment.order_id]);
        if (rows[0]?.coupon_code) await client.query('UPDATE coupons SET used_count=GREATEST(0,used_count-1) WHERE store_id=$1 AND upper(code)=upper($2)', [rows[0].store_id, rows[0].coupon_code]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    }
    res.json({ status: 'ok' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
