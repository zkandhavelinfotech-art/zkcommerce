const router = require('express').Router();
const pool = require('../db');
const crypto = require('crypto');

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error('Razorpay is not configured');
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
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
    res.json({ razorpay_order_id: rzpOrder.id, amount: rzpOrder.amount, currency: 'INR', key: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    try {
      const { rows } = await pool.query("UPDATE orders SET payment_status='failed',payment_failure=$1,updated_at=NOW() WHERE id=$2 AND payment_status='processing' AND payment_method='razorpay' RETURNING store_id,coupon_code", [String(e.message).slice(0,500), orderId]);
      if (rows[0]?.coupon_code) await pool.query('UPDATE coupons SET used_count=GREATEST(0,used_count-1) WHERE store_id=$1 AND upper(code)=upper($2)', [rows[0].store_id, rows[0].coupon_code]);
    } catch (_) {}
    res.status(503).json({ error: e.message });
  }
});

router.post('/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !order_id || !process.env.RAZORPAY_KEY_SECRET) return res.status(400).json({ error: 'Payment verification details are incomplete' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
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
    // Automated WhatsApp alert for paid Razorpay order
    try {
      const whatsapp = require('../services/whatsapp');
      const { rows: storeRows } = await pool.query('SELECT * FROM stores WHERE id=$1', [rows[0].store_id]);
      const lineItems = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items || '[]') : rows[0].items;
      whatsapp.sendOrderNotification({
        order: rows[0],
        store: storeRows[0] || {},
        items: lineItems
      }).catch(err => console.warn('[Payment Verify] WhatsApp alert warning:', err.message));
    } catch (_) {}
    res.json({ message: 'Payment verified', order_id: Number(order_id) });
  } catch (e) { res.status(503).json({ error: e.message }); }
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
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'Razorpay webhook secret is not configured' });
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
    if (!safeEqualHex(signature, expected)) return res.status(400).json({ error: 'Invalid webhook signature' });
    const event = req.body, payment = event?.payload?.payment?.entity;
    if (event.event === 'payment.captured' && payment?.order_id) {
      await pool.query(`UPDATE orders SET status='confirmed',payment_status='paid',razorpay_payment_id=$1,paid_at=COALESCE(paid_at,NOW()),updated_at=NOW()
        WHERE razorpay_order_id=$2 AND status='pending'`, [payment.id, payment.order_id]);
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
