const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../db');
const auth     = require('../middleware/auth');

const sign = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, store_id: user.store_id },
  process.env.JWT_SECRET, { expiresIn: '30d' }
);

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, store_name, phone } = req.body;
    if (!name || !email || !password || !store_name)
      return res.status(400).json({ error: 'name, email, password, store_name required' });
    const exists = await pool.query('SELECT id FROM merchants WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash  = await bcrypt.hash(password, 12);
    const { rows: [merchant] } = await pool.query(
      `INSERT INTO merchants (name,email,password_hash,phone,role)
       VALUES ($1,$2,$3,$4,'merchant') RETURNING id,name,email,role`,
      [name, email, hash, phone||null]
    );
    // Store creation waits until the merchant chooses a storefront design.
    merchant.store_name = store_name;
    res.status(201).json({ token: sign(merchant), user: merchant, store: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM merchants WHERE email=$1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const m = rows[0];
    if (!await bcrypt.compare(password, m.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: m.id, name: m.name, email: m.email, role: m.role, store_id: m.store_id };
    res.json({ token: sign(user), user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id,name,email,role,store_id,phone,created_at FROM merchants WHERE id=$1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query('SELECT id FROM merchants WHERE email=$1', [email]);
    if (!rows.length) return res.json({ message: 'If email exists, reset link sent' });
    const token = require('crypto').randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE merchants SET reset_token=$1, reset_token_expires=NOW()+interval'1 hour' WHERE email=$2`,
      [token, email]
    );
    // TODO: send email via Resend
    res.json({ message: 'Password reset link sent to your email' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id FROM merchants WHERE reset_token=$1 AND reset_token_expires > NOW()`, [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset token' });
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `UPDATE merchants SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE id=$2`,
      [hash, rows[0].id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/wa-signup  (WhatsApp OTP)
router.post('/wa-signup', async (req, res) => {
  try {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(
      `INSERT INTO otp_verifications (phone,otp,expires_at) VALUES ($1,$2,NOW()+interval'10 minutes')
       ON CONFLICT (phone) DO UPDATE SET otp=$2, expires_at=NOW()+interval'10 minutes'`,
      [phone, otp]
    );
    // TODO: send via Gupshup WhatsApp API
    console.log(`[WA OTP] ${phone}: ${otp}`);
    res.json({ message: 'OTP sent on WhatsApp', dev_otp: process.env.NODE_ENV==='development' ? otp : undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/wa-verify
router.post('/wa-verify', async (req, res) => {
  try {
    const { phone, otp, name, store_name } = req.body;
    const { rows } = await pool.query(
      `SELECT * FROM otp_verifications WHERE phone=$1 AND otp=$2 AND expires_at > NOW()`,
      [phone, otp]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired OTP' });
    await pool.query('DELETE FROM otp_verifications WHERE phone=$1', [phone]);
    let { rows: existing } = await pool.query('SELECT * FROM merchants WHERE phone=$1', [phone]);
    let merchant;
    if (existing.length) {
      merchant = existing[0];
    } else {
      const slug = (store_name||'my-store').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      const { rows: [m] } = await pool.query(
        `INSERT INTO merchants (name,phone,role) VALUES ($1,$2,'merchant') RETURNING id,name,phone,role`,
        [name||'Merchant', phone]
      );
      const { rows: [s] } = await pool.query(
        `INSERT INTO stores (merchant_id,store_name,slug,status) VALUES ($1,$2,$3,'draft') RETURNING id`,
        [m.id, store_name||'My Store', slug]
      );
      await pool.query('UPDATE merchants SET store_id=$1 WHERE id=$2', [s.id, m.id]);
      m.store_id = s.id;
      merchant = m;
    }
    const user = { id: merchant.id, phone: merchant.phone, role: merchant.role, store_id: merchant.store_id };
    res.json({ token: sign(user), user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
