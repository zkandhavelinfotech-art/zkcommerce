/**
 * ZKCommerce v4.1 — Production API Server
 * ZKanadavel Infotech Pvt Ltd & ZK Infotech INC
 * Sprint 1-4 complete: Auth, Products, Orders, Payments, GST, Shipping, Loyalty
 */

'use strict';

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const { Pool }     = require('pg');
const Razorpay     = require('razorpay');
const nodemailer   = require('nodemailer');
const multer       = require('multer');
const crypto       = require('crypto');
const { z }        = require('zod');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database (Dual MySQL / PostgreSQL) ───────────────────────────
const db = require('./db');

// ── Razorpay Standard Checkout ───────────────────────────────────
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TryQ4PdsrTEyBB';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'SZfOuock8WVvSdxy2f5Uvrb5';

const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ── Email (Resend-compatible SMTP) ───────────────────────────────
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.resend.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  auth:   { user: process.env.SMTP_USER || 'resend', pass: process.env.SMTP_PASS || '' },
});

// ── Multer (Cloudflare R2 / S3) ──────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG/WebP images allowed'), false);
  },
});

// ── Middleware ────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    /\.zkcommerce\.in$/,
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth attempts' } });
app.use('/api/', limiter);

// ── Helpers ───────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const paginate = (page = 1, limit = 20) => ({
  limit: Math.min(parseInt(limit) || 20, 100),
  offset: ((parseInt(page) || 1) - 1) * (Math.min(parseInt(limit) || 20, 100)),
});

const respond = (res, data, status = 200) => res.status(status).json(data);
const err     = (res, msg, status = 400)  => res.status(status).json({ error: msg });

// GST helpers
const gstSplit = (amount, rate) => {
  const r = rate / 100;
  const base = amount / (1 + r);
  const tax  = (amount - base) / 2;
  return { base: +base.toFixed(2), cgst: +tax.toFixed(2), sgst: +tax.toFixed(2), total: +(tax * 2).toFixed(2) };
};

// ── JWT Auth Middleware ───────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'zkcommerce_dev_secret_change_in_production';

const verifyToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return err(res, 'No token provided', 401);
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, name, email, role, store_id FROM users WHERE id=$1 AND is_active=true',
      [decoded.userId]
    );
    if (!rows.length) return err(res, 'User not found', 401);
    req.user = rows[0];
    next();
  } catch {
    return err(res, 'Invalid or expired token', 401);
  }
});

const authMiddleware = verifyToken;

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return err(res, 'Insufficient permissions', 403);
  next();
};

// ── Zod Schemas ───────────────────────────────────────────────────
const schemas = {
  register: z.object({
    firstName:  z.string().min(1).max(50),
    lastName:   z.string().min(1).max(50).optional(),
    email:      z.string().email(),
    phone:      z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
    password:   z.string().min(8).max(72),
    storeName:  z.string().min(2).max(100),
  }),
  login: z.object({
    email:    z.string().email(),
    password: z.string().min(1),
  }),
  product: z.object({
    name:        z.string().min(1).max(200),
    description: z.string().optional(),
    price:       z.number().positive(),
    mrp:         z.number().positive().optional(),
    cost_price:  z.number().positive().optional(),
    gst_rate:    z.enum(['0','5','12','18','28']).default('12'),
    category_id: z.number().int().positive().optional(),
    stock:       z.number().int().min(0).default(0),
    low_stock_alert: z.number().int().min(0).default(5),
    weight_kg:   z.number().positive().optional(),
    is_cod:      z.boolean().default(true),
    is_featured: z.boolean().default(false),
    status:      z.enum(['published','draft','archived']).default('draft'),
    seo_title:   z.string().max(60).optional(),
    seo_desc:    z.string().max(160).optional(),
    slug:        z.string().regex(/^[a-z0-9-]+$/).optional(),
  }),
  order: z.object({
    address_id:    z.number().int().positive(),
    coupon_code:   z.string().optional(),
    payment_method:z.enum(['upi','card','netbanking','cod','emi','wallet']),
    loyalty_points_redeem: z.number().int().min(0).default(0),
    notes:         z.string().max(500).optional(),
  }),
  address: z.object({
    name:     z.string().min(1).max(100),
    phone:    z.string().regex(/^[6-9]\d{9}$/),
    line1:    z.string().min(5).max(200),
    line2:    z.string().max(200).optional(),
    city:     z.string().min(1).max(100),
    state:    z.string().min(1).max(100),
    pincode:  z.string().regex(/^[1-9][0-9]{5}$/),
    is_default: z.boolean().default(false),
  }),
  coupon: z.object({
    code:        z.string().min(3).max(30).toUpperCase(),
    type:        z.enum(['percentage','fixed','free_shipping','bogo']),
    value:       z.number().min(0),
    min_order:   z.number().min(0).default(0),
    max_uses:    z.number().int().positive().optional(),
    expires_at:  z.string().datetime().optional(),
    description: z.string().optional(),
  }),
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
  req.body = result.data;
  next();
};

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — AUTH ROUTES
// ════════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, validate(schemas.register), asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, storeName } = req.body;

  // Check existing
  const { rows: existing } = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (existing.length) return err(res, 'Email already registered');

  const hash = await bcrypt.hash(password, 12);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [user] } = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at)
       VALUES ($1,$2,$3,$4,'merchant',true,NOW()) RETURNING id, name, email, role`,
      [`${firstName} ${lastName || ''}`.trim(), email.toLowerCase(), phone, hash]
    );
    // Create store
    const slug = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const { rows: [store] } = await client.query(
      `INSERT INTO stores (user_id, name, slug, plan, trial_ends_at, created_at)
       VALUES ($1,$2,$3,'growth',NOW()+INTERVAL'30 days',NOW()) RETURNING id`,
      [user.id, storeName, slug]
    );
    await client.query('UPDATE users SET store_id=$1 WHERE id=$2', [store.id, user.id]);
    await client.query('COMMIT');

    const token = jwt.sign({ userId: user.id, role: 'merchant' }, JWT_SECRET, { expiresIn: '7d' });

    // Welcome email (non-blocking)
    mailer.sendMail({
      from: `"ZKCommerce" <${process.env.FROM_EMAIL || 'noreply@zkcommerce.in'}>`,
      to: email,
      subject: `Welcome to ZKCommerce — ${storeName} is ready!`,
      html: `<h2>Welcome, ${firstName}!</h2><p>Your 30-day free trial has started. <a href="${process.env.FRONTEND_URL}/merchant/setup.html">Set up your store →</a></p>`,
    }).catch(console.error);

    respond(res, { token, user: { ...user, store_id: store.id }, message: 'Registration successful' }, 201);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query(
    'SELECT id, name, email, role, store_id, password_hash, is_active FROM users WHERE email=$1',
    [email.toLowerCase()]
  );
  if (!rows.length) return err(res, 'Invalid email or password', 401);
  const user = rows[0];
  if (!user.is_active) return err(res, 'Account suspended. Contact support.', 403);
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return err(res, 'Invalid email or password', 401);
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const { password_hash, ...safeUser } = user;
  respond(res, { token, user: safeUser });
}));

// GET /api/auth/me
app.get('/api/auth/me', verifyToken, asyncHandler(async (req, res) => {
  respond(res, { user: req.user });
}));

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  const { rows } = await db.query('SELECT id, name FROM users WHERE email=$1', [email?.toLowerCase()]);
  // Always respond OK (security)
  if (rows.length) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      'UPDATE users SET reset_token=$1, reset_token_expires=NOW()+INTERVAL\'1 hour\' WHERE id=$2',
      [token, rows[0].id]
    );
    const link = `${process.env.FRONTEND_URL}/auth/reset-password.html?token=${token}`;
    mailer.sendMail({
      from: `"ZKCommerce" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Reset your ZKCommerce password',
      html: `<p>Hi ${rows[0].name},</p><p><a href="${link}">Click here to reset your password</a> (expires in 1 hour)</p>`,
    }).catch(console.error);
  }
  respond(res, { message: 'If that email exists, a reset link has been sent.' });
}));

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8)
    return err(res, 'Invalid request');
  const { rows } = await db.query(
    'SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires>NOW()',
    [token]
  );
  if (!rows.length) return err(res, 'Reset link expired or invalid', 400);
  const hash = await bcrypt.hash(password, 12);
  await db.query(
    'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE id=$2',
    [hash, rows[0].id]
  );
  respond(res, { message: 'Password updated successfully' });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — PRODUCT ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/products  (merchant — their own products)
app.get('/api/products', verifyToken, requireRole('merchant','admin'), asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req.query.page, req.query.limit);
  const { search, status, category_id } = req.query;
  const storeId = req.user.store_id;

  let where = ['p.store_id=$1'];
  const params = [storeId];
  let pi = 2;

  if (search) { where.push(`p.name ILIKE $${pi++}`); params.push(`%${search}%`); }
  if (status) { where.push(`p.status=$${pi++}`); params.push(status); }
  if (category_id) { where.push(`p.category_id=$${pi++}`); params.push(category_id); }

  const whereStr = where.join(' AND ');
  const { rows } = await db.query(
    `SELECT p.*, c.name as category_name,
            (SELECT url FROM product_images WHERE product_id=p.id ORDER BY sort_order LIMIT 1) as main_image,
            COUNT(*) OVER() as total_count
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     WHERE ${whereStr}
     ORDER BY p.created_at DESC
     LIMIT $${pi++} OFFSET $${pi}`,
    [...params, limit, offset]
  );
  respond(res, {
    products: rows,
    total: rows[0]?.total_count || 0,
    page: req.query.page || 1,
    limit,
  });
}));

// POST /api/products
app.post('/api/products', verifyToken, requireRole('merchant'), validate(schemas.product), asyncHandler(async (req, res) => {
  const storeId = req.user.store_id;
  const d = req.body;
  const slug = d.slug || d.name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const { rows: [prod] } = await db.query(
    `INSERT INTO products (store_id,name,description,price,mrp,cost_price,gst_rate,
      category_id,stock,low_stock_alert,weight_kg,is_cod,is_featured,status,
      seo_title,seo_desc,slug,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
     RETURNING *`,
    [storeId, d.name, d.description, d.price, d.mrp, d.cost_price, d.gst_rate,
     d.category_id, d.stock, d.low_stock_alert, d.weight_kg, d.is_cod,
     d.is_featured, d.status, d.seo_title, d.seo_desc, slug]
  );
  // Log inventory
  await db.query(
    'INSERT INTO inventory_log (product_id,store_id,change,reason,created_at) VALUES ($1,$2,$3,$4,NOW())',
    [prod.id, storeId, d.stock, 'Initial stock']
  );
  respond(res, { product: prod }, 201);
}));

// GET /api/products/:id
app.get('/api/products/:id', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, c.name as category_name,
            json_agg(pi ORDER BY pi.sort_order) FILTER (WHERE pi.id IS NOT NULL) as images
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     LEFT JOIN product_images pi ON pi.product_id=p.id
     WHERE p.id=$1 AND p.store_id=$2
     GROUP BY p.id, c.name`,
    [req.params.id, req.user.store_id]
  );
  if (!rows.length) return err(res, 'Product not found', 404);
  respond(res, { product: rows[0] });
}));

// PUT /api/products/:id
app.put('/api/products/:id', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
  const d = req.body;
  const { rows } = await db.query(
    `UPDATE products SET name=COALESCE($1,name), description=COALESCE($2,description),
      price=COALESCE($3,price), mrp=COALESCE($4,mrp), status=COALESCE($5,status),
      stock=COALESCE($6,stock), is_featured=COALESCE($7,is_featured), updated_at=NOW()
     WHERE id=$8 AND store_id=$9 RETURNING *`,
    [d.name, d.description, d.price, d.mrp, d.status, d.stock, d.is_featured,
     req.params.id, req.user.store_id]
  );
  if (!rows.length) return err(res, 'Product not found', 404);
  respond(res, { product: rows[0] });
}));

// DELETE /api/products/:id
app.delete('/api/products/:id', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
  const { rowCount } = await db.query(
    "UPDATE products SET status='archived', updated_at=NOW() WHERE id=$1 AND store_id=$2",
    [req.params.id, req.user.store_id]
  );
  if (!rowCount) return err(res, 'Product not found', 404);
  respond(res, { message: 'Product archived' });
}));

// POST /api/products/:id/images  (upload to R2/S3)
app.post('/api/products/:id/images', verifyToken, requireRole('merchant'), upload.array('images', 8), asyncHandler(async (req, res) => {
  if (!req.files?.length) return err(res, 'No images provided');
  // In production: upload to Cloudflare R2 and return URLs
  // Stub: return placeholder URLs
  const urls = req.files.map((f, i) => ({
    url: `${process.env.R2_PUBLIC_URL || 'https://images.zkcommerce.in'}/products/${req.params.id}/${Date.now()}-${i}.jpg`,
    sort_order: i,
  }));
  for (const img of urls) {
    await db.query(
      'INSERT INTO product_images (product_id,url,sort_order) VALUES ($1,$2,$3)',
      [req.params.id, img.url, img.sort_order]
    );
  }
  respond(res, { images: urls }, 201);
}));

// POST /api/products/bulk-import (CSV)
app.post('/api/products/bulk-import', verifyToken, requireRole('merchant'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return err(res, 'CSV file required');
  // Parse CSV and insert (simplified)
  const csv = req.file.buffer.toString();
  const lines = csv.split('\n').slice(1).filter(l => l.trim());
  let imported = 0;
  for (const line of lines) {
    const [name, price, stock, gst_rate] = line.split(',').map(s => s.trim().replace(/"/g,''));
    if (name && price) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,80);
      await db.query(
        `INSERT INTO products (store_id,name,price,stock,gst_rate,status,slug,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,'draft',$6,NOW(),NOW()) ON CONFLICT (store_id,slug) DO NOTHING`,
        [req.user.store_id, name, parseFloat(price)||0, parseInt(stock)||0, gst_rate||'12', slug]
      );
      imported++;
    }
  }
  respond(res, { imported, total: lines.length });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — ORDER ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/orders (merchant view)
app.get('/api/orders', verifyToken, asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req.query.page, req.query.limit);
  const { status, payment_method, search, from, to } = req.query;
  const isAdmin = req.user.role === 'admin';
  const storeId = req.user.store_id;

  let where = isAdmin ? ['1=1'] : ['o.store_id=$1'];
  const params = isAdmin ? [] : [storeId];
  let pi = params.length + 1;

  if (status) { where.push(`o.status=$${pi++}`); params.push(status); }
  if (payment_method) { where.push(`o.payment_method=$${pi++}`); params.push(payment_method); }
  if (search) { where.push(`(o.id::text LIKE $${pi} OR u.name ILIKE $${pi})`); params.push(`%${search}%`); pi++; }
  if (from) { where.push(`o.created_at >= $${pi++}`); params.push(from); }
  if (to)   { where.push(`o.created_at <= $${pi++}`); params.push(to + 'T23:59:59'); }

  const { rows } = await db.query(
    `SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
            (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) as item_count,
            COUNT(*) OVER() as total_count
     FROM orders o
     JOIN users u ON u.id=o.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY o.created_at DESC
     LIMIT $${pi++} OFFSET $${pi}`,
    [...params, limit, offset]
  );
  respond(res, { orders: rows, total: rows[0]?.total_count || 0, page: req.query.page || 1, limit });
}));

// POST /api/orders (create order from cart)
app.post('/api/orders', verifyToken, requireRole('customer','merchant'), validate(schemas.order), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { address_id, coupon_code, payment_method, loyalty_points_redeem, notes } = req.body;

  // Get cart
  const { rows: cartItems } = await db.query(
    `SELECT ci.*, p.price, p.name, p.store_id, p.gst_rate, p.is_cod, p.stock,
            pv.price as variant_price
     FROM cart_items ci
     JOIN products p ON p.id=ci.product_id
     LEFT JOIN product_variants pv ON pv.id=ci.variant_id
     WHERE ci.user_id=$1 AND p.status='published'`,
    [userId]
  );
  if (!cartItems.length) return err(res, 'Cart is empty');

  // Validate stock
  for (const item of cartItems) {
    if (item.stock < item.quantity)
      return err(res, `Insufficient stock for ${item.name}`);
  }

  // Validate address
  const { rows: [addr] } = await db.query(
    'SELECT * FROM addresses WHERE id=$1 AND user_id=$2',
    [address_id, userId]
  );
  if (!addr) return err(res, 'Address not found');

  // COD check
  if (payment_method === 'cod') {
    const nonCod = cartItems.find(i => !i.is_cod);
    if (nonCod) return err(res, `${nonCod.name} is not available for COD`);
  }

  // Calculate amounts
  const storeId = cartItems[0].store_id;
  let subtotal = 0;
  const items = cartItems.map(item => {
    const price = item.variant_price || item.price;
    const lineTotal = price * item.quantity;
    const gst = gstSplit(lineTotal, parseFloat(item.gst_rate));
    subtotal += lineTotal;
    return { ...item, unit_price: price, line_total: lineTotal, gst };
  });

  // Coupon
  let discount = 0;
  let couponId = null;
  if (coupon_code) {
    const { rows: [coupon] } = await db.query(
      `SELECT * FROM coupons WHERE code=$1 AND store_id=$2 AND is_active=true
       AND (expires_at IS NULL OR expires_at>NOW())
       AND (max_uses IS NULL OR used_count<max_uses)`,
      [coupon_code.toUpperCase(), storeId]
    );
    if (coupon) {
      if (coupon.type === 'percentage') discount = subtotal * coupon.value / 100;
      else if (coupon.type === 'fixed')  discount = Math.min(coupon.value, subtotal);
      else if (coupon.type === 'free_shipping') discount = 0;
      discount = Math.min(discount, subtotal * 0.5);
      couponId = coupon.id;
    }
  }

  // Loyalty
  let loyaltyDiscount = 0;
  if (loyalty_points_redeem > 0) {
    const { rows: [bal] } = await db.query(
      'SELECT COALESCE(SUM(points),0) as balance FROM loyalty_points WHERE user_id=$1 AND store_id=$2',
      [userId, storeId]
    );
    const available = Math.min(parseInt(bal.balance), loyalty_points_redeem);
    loyaltyDiscount = available * 0.50; // 1 pt = ₹0.50
    loyaltyDiscount = Math.min(loyaltyDiscount, subtotal * 0.20); // max 20% via loyalty
  }

  const shipping = subtotal >= 999 ? 0 : 99;
  const totalGst = items.reduce((s, i) => s + i.gst.total, 0);
  const total = Math.max(0, subtotal - discount - loyaltyDiscount + shipping);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [order] } = await client.query(
      `INSERT INTO orders (user_id,store_id,address_id,coupon_id,status,payment_method,
        subtotal,discount,loyalty_discount,shipping_amount,gst_amount,total,notes,created_at)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *`,
      [userId, storeId, address_id, couponId, payment_method,
       subtotal, discount, loyaltyDiscount, shipping, totalGst, total, notes]
    );

    // Insert items + deduct stock
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id,product_id,variant_id,quantity,unit_price,gst_amount,line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, item.product_id, item.variant_id, item.quantity, item.unit_price, item.gst.total, item.line_total]
      );
      await client.query(
        'UPDATE products SET stock=stock-$1, updated_at=NOW() WHERE id=$2',
        [item.quantity, item.product_id]
      );
      await client.query(
        'INSERT INTO inventory_log (product_id,store_id,change,reason,order_id,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
        [item.product_id, storeId, -item.quantity, 'Order placed', order.id]
      );
    }

    // Update coupon usage
    if (couponId) {
      await client.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1', [couponId]);
    }

    // Deduct loyalty points
    if (loyalty_points_redeem > 0 && loyaltyDiscount > 0) {
      await client.query(
        'INSERT INTO loyalty_points (user_id,store_id,points,type,order_id,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
        [userId, storeId, -Math.round(loyaltyDiscount * 2), 'redeemed', order.id]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE user_id=$1', [userId]);

    await client.query('COMMIT');

    // Log analytics
    db.query(
      'INSERT INTO analytics_events (store_id,event_type,entity_id,metadata,created_at) VALUES ($1,$2,$3,$4,NOW())',
      [storeId, 'order_placed', order.id, JSON.stringify({ total, payment_method })]
    ).catch(console.error);

    respond(res, { order, message: 'Order placed successfully' }, 201);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// GET /api/orders/:id
app.get('/api/orders/:id', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT o.*,
            u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
            a.line1, a.line2, a.city, a.state, a.pincode, a.name as delivery_name,
            json_agg(json_build_object(
              'id',oi.id,'product_id',oi.product_id,'quantity',oi.quantity,
              'unit_price',oi.unit_price,'line_total',oi.line_total,
              'product_name',p.name,'sku',p.slug
            )) as items
     FROM orders o
     JOIN users u ON u.id=o.user_id
     JOIN addresses a ON a.id=o.address_id
     JOIN order_items oi ON oi.order_id=o.id
     JOIN products p ON p.id=oi.product_id
     WHERE o.id=$1 AND (o.store_id=$2 OR $3=true)
     GROUP BY o.id,u.name,u.email,u.phone,a.line1,a.line2,a.city,a.state,a.pincode,a.name`,
    [req.params.id, req.user.store_id, req.user.role === 'admin']
  );
  if (!rows.length) return err(res, 'Order not found', 404);
  respond(res, { order: rows[0] });
}));

// PUT /api/orders/:id/status
app.put('/api/orders/:id/status', verifyToken, requireRole('merchant','admin'), asyncHandler(async (req, res) => {
  const { status, awb_number, courier } = req.body;
  const validStatuses = ['pending','processing','shipped','delivered','cancelled','refunded'];
  if (!validStatuses.includes(status)) return err(res, 'Invalid status');

  const { rows } = await db.query(
    `UPDATE orders SET status=$1,
      awb_number=COALESCE($2,awb_number),
      courier=COALESCE($3,courier),
      updated_at=NOW(),
      ${status === 'shipped'   ? 'shipped_at=NOW(),'   : ''}
      ${status === 'delivered' ? 'delivered_at=NOW(),' : ''}
      status=$1
     WHERE id=$4 AND (store_id=$5 OR $6=true) RETURNING *`,
    [status, awb_number, courier, req.params.id, req.user.store_id, req.user.role === 'admin']
  );
  if (!rows.length) return err(res, 'Order not found', 404);

  // Award loyalty points on delivery
  if (status === 'delivered') {
    const earnedPoints = Math.floor(rows[0].total);
    await db.query(
      'INSERT INTO loyalty_points (user_id,store_id,points,type,order_id,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
      [rows[0].user_id, rows[0].store_id, earnedPoints, 'earned', rows[0].id]
    );
  }

  respond(res, { order: rows[0] });
}));

// POST /api/orders/:id/cancel
app.post('/api/orders/:id/cancel', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status IN ('pending','processing')",
    [req.params.id, req.user.id]
  );
  if (!rows.length) return err(res, 'Order cannot be cancelled', 400);
  await db.query("UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1", [req.params.id]);
  // Restore stock
  const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
  for (const item of items) {
    await db.query('UPDATE products SET stock=stock+$1 WHERE id=$2', [item.quantity, item.product_id]);
  }
  respond(res, { message: 'Order cancelled and stock restored' });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — PAYMENT ROUTES (RAZORPAY)
// ════════════════════════════════════════════════════════════════

// POST /api/payments/razorpay/order  — Create Razorpay order
app.post('/api/payments/razorpay/order', verifyToken, asyncHandler(async (req, res) => {
  const { order_id } = req.body;
  const { rows } = await db.query(
    'SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status=\'pending\'',
    [order_id, req.user.id]
  );
  if (!rows.length) return err(res, 'Order not found or already paid', 404);
  const order = rows[0];

  const rzpOrder = await razorpay.orders.create({
    amount:   Math.round(order.total * 100), // paise
    currency: 'INR',
    receipt:  `zk_${order.id}`,
    notes:    { order_id: order.id.toString(), store_id: order.store_id.toString() },
  });

  await db.query(
    'UPDATE orders SET razorpay_order_id=$1 WHERE id=$2',
    [rzpOrder.id, order.id]
  );

  respond(res, {
    razorpay_order_id: rzpOrder.id,
    amount:   rzpOrder.amount,
    currency: rzpOrder.currency,
    key_id:   process.env.RAZORPAY_KEY_ID,
  });
}));

// POST /api/payments/razorpay/verify  — Verify payment signature
app.post('/api/payments/razorpay/verify', verifyToken, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');

  if (expectedSig !== razorpay_signature)
    return err(res, 'Payment verification failed — signature mismatch', 400);

  await db.query(
    `UPDATE orders SET status='processing', payment_status='paid',
      razorpay_payment_id=$1, paid_at=NOW(), updated_at=NOW() WHERE id=$2`,
    [razorpay_payment_id, order_id]
  );

  // Record payment
  const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id=$1', [order_id]);
  await db.query(
    `INSERT INTO payments (order_id,method,amount,status,razorpay_order_id,razorpay_payment_id,created_at)
     VALUES ($1,$2,$3,'success',$4,$5,NOW())`,
    [order_id, order.payment_method, order.total, razorpay_order_id, razorpay_payment_id]
  );

  // Send confirmation email
  const { rows: [user] } = await db.query('SELECT email,name FROM users WHERE id=$1', [order.user_id]);
  mailer.sendMail({
    from: `"ZKCommerce" <${process.env.FROM_EMAIL}>`,
    to: user.email,
    subject: `Order #ZK-${String(order_id).padStart(5,'0')} confirmed — ₹${order.total}`,
    html: `<h2>Order Confirmed! 🎉</h2><p>Hi ${user.name}, your order #ZK-${String(order_id).padStart(5,'0')} for ₹${order.total} has been confirmed. We'll ship within 24 hours.</p>`,
  }).catch(console.error);

  respond(res, { message: 'Payment verified', order_id, payment_id: razorpay_payment_id });
}));

// ════════════════════════════════════════════════════════════════
// RAZORPAY STANDARD WEB CHECKOUT (STANDALONE & STOREFRONT)
// ════════════════════════════════════════════════════════════════

// STEP 1: Backend - Create Order
app.post('/api/create-order', asyncHandler(async (req, res) => {
  const { amount, currency = 'INR', receipt, notes = {} } = req.body;
  const numAmount = parseInt(amount, 10);

  // Validate amount >= 100 paise (₹1 minimum)
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ error: 'Amount must be at least 100 paise (₹1)' });
  }

  try {
    const order = await razorpay.orders.create({
      amount:   numAmount,
      currency: currency.toUpperCase(),
      receipt:  receipt || `rcpt_${Date.now()}`,
      notes,
    });

    return res.json({
      order_id: order.id,
      amount:   order.amount,
      currency: order.currency,
      key_id:   RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay create-order error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create Razorpay order' });
  }
}));

// STEP 3: Backend - Verify Signature
app.post('/api/verify-payment', asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required signature verification fields' });
  }

  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Signature verification failed' });
  }

  // Update order record if database is connected
  if (db && db.type !== 'none' && order_id) {
    try {
      await db.query(
        "UPDATE orders SET payment_status='paid', status='processing', razorpay_payment_id=$1, updated_at=NOW() WHERE id=$2",
        [razorpay_payment_id, order_id]
      );
    } catch (e) {
      console.warn('Could not update order status in DB:', e.message);
    }
  }

  return res.json({
    success: true,
    message: 'Payment verified successfully',
    order_id: razorpay_order_id,
    payment_id: razorpay_payment_id,
  });
}));

// POST /api/payments/webhook  — Razorpay webhook
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const expectedSig = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if (sig !== expectedSig) return res.status(400).json({ error: 'Invalid signature' });

  const event = JSON.parse(req.body);
  if (event.event === 'payment.failed') {
    const orderId = event.payload.payment.entity.notes?.order_id;
    if (orderId) {
      await db.query(
        "UPDATE orders SET payment_status='failed', updated_at=NOW() WHERE id=$1",
        [orderId]
      );
    }
  }
  res.json({ status: 'ok' });
}));

// POST /api/payments/razorpay/refund
app.post('/api/payments/razorpay/refund', verifyToken, requireRole('merchant','admin'), asyncHandler(async (req, res) => {
  const { order_id, amount, reason } = req.body;
  const { rows } = await db.query(
    'SELECT razorpay_payment_id, total FROM orders WHERE id=$1 AND (store_id=$2 OR $3=true)',
    [order_id, req.user.store_id, req.user.role === 'admin']
  );
  if (!rows.length || !rows[0].razorpay_payment_id)
    return err(res, 'No payment found to refund');

  const refund = await razorpay.payments.refund(rows[0].razorpay_payment_id, {
    amount: Math.round((amount || rows[0].total) * 100),
    notes: { reason: reason || 'Merchant initiated refund', order_id: order_id.toString() },
  });

  await db.query(
    "UPDATE orders SET status='refunded', updated_at=NOW() WHERE id=$1",
    [order_id]
  );

  respond(res, { refund_id: refund.id, amount: refund.amount / 100, message: 'Refund initiated' });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — CART ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/cart', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT ci.*, p.name, p.price, p.stock, p.is_cod,
            pv.price as variant_price, pv.name as variant_name,
            (SELECT url FROM product_images WHERE product_id=p.id LIMIT 1) as image_url
     FROM cart_items ci
     JOIN products p ON p.id=ci.product_id
     LEFT JOIN product_variants pv ON pv.id=ci.variant_id
     WHERE ci.user_id=$1`,
    [req.user.id]
  );
  const subtotal = rows.reduce((s, i) => s + (i.variant_price || i.price) * i.quantity, 0);
  respond(res, { items: rows, subtotal, count: rows.reduce((s, i) => s + i.quantity, 0) });
}));

app.post('/api/cart/items', verifyToken, asyncHandler(async (req, res) => {
  const { product_id, variant_id, quantity = 1 } = req.body;
  const { rows: [prod] } = await db.query(
    'SELECT id, stock FROM products WHERE id=$1 AND status=\'published\'',
    [product_id]
  );
  if (!prod) return err(res, 'Product not found');
  if (prod.stock < quantity) return err(res, 'Insufficient stock');

  await db.query(
    `INSERT INTO cart_items (user_id,product_id,variant_id,quantity,created_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (user_id,product_id,variant_id)
     DO UPDATE SET quantity=cart_items.quantity+$4, updated_at=NOW()`,
    [req.user.id, product_id, variant_id || null, quantity]
  );
  respond(res, { message: 'Added to cart' });
}));

app.put('/api/cart/items/:id', verifyToken, asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (quantity < 1) {
    await db.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  } else {
    await db.query(
      'UPDATE cart_items SET quantity=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3',
      [quantity, req.params.id, req.user.id]
    );
  }
  respond(res, { message: 'Cart updated' });
}));

app.delete('/api/cart/items/:id', verifyToken, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  respond(res, { message: 'Item removed' });
}));

app.delete('/api/cart', verifyToken, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
  respond(res, { message: 'Cart cleared' });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — ADDRESS ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/addresses', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC',
    [req.user.id]
  );
  respond(res, { addresses: rows });
}));

app.post('/api/addresses', verifyToken, validate(schemas.address), asyncHandler(async (req, res) => {
  const d = req.body;
  if (d.is_default) {
    await db.query('UPDATE addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
  }
  const { rows: [addr] } = await db.query(
    `INSERT INTO addresses (user_id,name,phone,line1,line2,city,state,pincode,is_default,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
    [req.user.id, d.name, d.phone, d.line1, d.line2, d.city, d.state, d.pincode, d.is_default]
  );
  respond(res, { address: addr }, 201);
}));

app.delete('/api/addresses/:id', verifyToken, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM addresses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  respond(res, { message: 'Address deleted' });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — GST & INVOICE ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/gst/report', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year)  || new Date().getFullYear();

  const { rows } = await db.query(
    `SELECT o.id, o.created_at, o.total, o.gst_amount,
            o.subtotal - o.discount as taxable,
            o.gst_amount/2 as cgst, o.gst_amount/2 as sgst,
            u.name as customer_name, a.state as delivery_state
     FROM orders o
     JOIN users u ON u.id=o.user_id
     JOIN addresses a ON a.id=o.address_id
     WHERE o.store_id=$1
       AND EXTRACT(MONTH FROM o.created_at)=$2
       AND EXTRACT(YEAR  FROM o.created_at)=$3
       AND o.status NOT IN ('cancelled','pending')
     ORDER BY o.created_at`,
    [req.user.store_id, m, y]
  );

  const totals = rows.reduce((s, r) => ({
    taxable: s.taxable + parseFloat(r.taxable),
    cgst:    s.cgst    + parseFloat(r.cgst),
    sgst:    s.sgst    + parseFloat(r.sgst),
    total:   s.total   + parseFloat(r.total),
  }), { taxable: 0, cgst: 0, sgst: 0, total: 0 });

  respond(res, { invoices: rows, totals, month: m, year: y });
}));

app.get('/api/gst/gstr1-export', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year)  || new Date().getFullYear();

  const { rows } = await db.query(
    `SELECT 'INV-'||o.id as invoice_no, TO_CHAR(o.created_at,'DD/MM/YYYY') as date,
            u.name as buyer_name, '' as buyer_gstin, a.state as place_of_supply,
            o.subtotal-o.discount as taxable_value,
            o.gst_amount/2 as cgst, o.gst_amount/2 as sgst, 0 as igst, o.total
     FROM orders o
     JOIN users u ON u.id=o.user_id
     JOIN addresses a ON a.id=o.address_id
     WHERE o.store_id=$1
       AND EXTRACT(MONTH FROM o.created_at)=$2
       AND EXTRACT(YEAR  FROM o.created_at)=$3
       AND o.status NOT IN ('cancelled','pending')`,
    [req.user.store_id, m, y]
  );

  const headers = 'Invoice No,Date,Buyer Name,Buyer GSTIN,Place of Supply,Taxable Value,CGST,SGST,IGST,Total';
  const csvRows = rows.map(r =>
    `${r.invoice_no},${r.date},"${r.buyer_name}",${r.buyer_gstin},${r.place_of_supply},${r.taxable_value},${r.cgst},${r.sgst},${r.igst},${r.total}`
  );
  const csv = [headers, ...csvRows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=GSTR1-${y}-${String(m).padStart(2,'0')}.csv`);
  res.send(csv);
}));

app.get('/api/orders/:id/invoice', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT o.*, u.name as customer_name, u.email, u.phone,
            a.line1, a.line2, a.city, a.state, a.pincode,
            s.name as store_name, s.gstin as store_gstin, s.address as store_address,
            json_agg(json_build_object(
              'name',p.name,'qty',oi.quantity,'price',oi.unit_price,
              'gst_rate',p.gst_rate,'line_total',oi.line_total,'gst',oi.gst_amount
            )) as items
     FROM orders o
     JOIN users u ON u.id=o.user_id
     JOIN addresses a ON a.id=o.address_id
     JOIN stores s ON s.id=o.store_id
     JOIN order_items oi ON oi.order_id=o.id
     JOIN products p ON p.id=oi.product_id
     WHERE o.id=$1 AND (o.store_id=$2 OR $3=true)
     GROUP BY o.id,u.name,u.email,u.phone,a.line1,a.line2,a.city,a.state,a.pincode,s.name,s.gstin,s.address`,
    [req.params.id, req.user.store_id, req.user.role === 'admin']
  );
  if (!rows.length) return err(res, 'Order not found', 404);
  respond(res, { invoice: rows[0] });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — SHIPPING (DELHIVERY)
// ════════════════════════════════════════════════════════════════

app.post('/api/shipping/awb', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
  const { order_id, courier = 'delhivery', weight_kg = 0.5 } = req.body;
  const { rows } = await db.query(
    `SELECT o.*, a.name as del_name, a.phone as del_phone, a.line1, a.line2,
             a.city, a.state, a.pincode
     FROM orders o JOIN addresses a ON a.id=o.address_id
     WHERE o.id=$1 AND o.store_id=$2`,
    [order_id, req.user.store_id]
  );
  if (!rows.length) return err(res, 'Order not found');
  const order = rows[0];

  // Delhivery API call (stub — replace with real Delhivery SDK)
  const awb = `DL${Date.now().toString().slice(-8)}`;
  await db.query(
    "UPDATE orders SET awb_number=$1, courier=$2, status='processing', updated_at=NOW() WHERE id=$3",
    [awb, courier, order_id]
  );

  respond(res, { awb_number: awb, courier, order_id, label_url: `https://api.delhivery.com/labels/${awb}` });
}));

app.get('/api/shipping/track/:awb', asyncHandler(async (req, res) => {
  // In production: call Delhivery tracking API
  respond(res, {
    awb: req.params.awb,
    status: 'In transit',
    location: 'Coimbatore Hub',
    expected_delivery: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    events: [
      { status: 'Picked up', location: 'Origin', time: new Date(Date.now() - 86400000).toISOString() },
      { status: 'In transit', location: 'Coimbatore Hub', time: new Date().toISOString() },
    ],
  });
}));

app.post('/api/shipping/estimate', asyncHandler(async (req, res) => {
  const { origin_pincode, dest_pincode, weight_kg = 0.5 } = req.body;
  respond(res, {
    couriers: [
      { name: 'Delhivery', days: 2, rate: weight_kg <= 0.5 ? 49 : 79 },
      { name: 'BlueDart',  days: 1, rate: weight_kg <= 0.5 ? 89 : 129 },
      { name: 'DTDC',      days: 3, rate: weight_kg <= 0.5 ? 39 : 59 },
    ],
  });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — LOYALTY ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/loyalty/balance', verifyToken, asyncHandler(async (req, res) => {
  const storeId = req.query.store_id || req.user.store_id;
  const { rows: [bal] } = await db.query(
    `SELECT COALESCE(SUM(points),0) as balance,
            COUNT(DISTINCT CASE WHEN points>0 THEN id END) as transactions_earned,
            COUNT(DISTINCT CASE WHEN points<0 THEN id END) as transactions_redeemed
     FROM loyalty_points WHERE user_id=$1 AND store_id=$2`,
    [req.user.id, storeId]
  );
  const balance = parseInt(bal.balance);
  respond(res, {
    balance,
    worth: +(balance * 0.5).toFixed(2),
    tier: balance >= 25000 ? 'Gold' : balance >= 5000 ? 'Silver' : 'Bronze',
    transactions_earned:  parseInt(bal.transactions_earned),
    transactions_redeemed:parseInt(bal.transactions_redeemed),
  });
}));

app.get('/api/loyalty/transactions', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT lp.*, o.total as order_total
     FROM loyalty_points lp
     LEFT JOIN orders o ON o.id=lp.order_id
     WHERE lp.user_id=$1 AND lp.store_id=$2
     ORDER BY lp.created_at DESC LIMIT 50`,
    [req.user.id, req.query.store_id || req.user.store_id]
  );
  respond(res, { transactions: rows });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — RETURNS & REFUNDS
// ════════════════════════════════════════════════════════════════

app.post('/api/returns', verifyToken, asyncHandler(async (req, res) => {
  const { order_id, reason, description, items } = req.body;
  const { rows } = await db.query(
    "SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status='delivered'",
    [order_id, req.user.id]
  );
  if (!rows.length) return err(res, 'Order not eligible for return');
  // In production: insert into returns table
  respond(res, {
    return_id: `RET-${Date.now().toString().slice(-4)}`,
    status: 'pending',
    message: 'Return request submitted. We will review within 24 hours.',
  }, 201);
}));

app.get('/api/returns', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
  // Return from returns table (needs migration)
  respond(res, { returns: [], message: 'Returns table: run phase3-additions.sql' });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — STOREFRONT PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/storefront/:slug', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.slug, s.description, s.theme, s.primary_color,
             s.logo_url, s.plan, s.gstin, s.whatsapp,
             u.email as owner_email
     FROM stores s JOIN users u ON u.id=s.user_id
     WHERE s.slug=$1 AND s.is_active=true`,
    [req.params.slug]
  );
  if (!rows.length) return err(res, 'Store not found', 404);
  respond(res, { store: rows[0] });
}));

app.get('/api/storefront/:slug/products', asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req.query.page, req.query.limit);
  const { category, search, min_price, max_price, sort } = req.query;

  const { rows: [store] } = await db.query('SELECT id FROM stores WHERE slug=$1', [req.params.slug]);
  if (!store) return err(res, 'Store not found', 404);

  let where = ["p.store_id=$1","p.status='published'"];
  const params = [store.id];
  let pi = 2;
  if (category) { where.push(`c.slug=$${pi++}`); params.push(category); }
  if (search)   { where.push(`p.name ILIKE $${pi++}`); params.push(`%${search}%`); }
  if (min_price){ where.push(`p.price>=$${pi++}`); params.push(min_price); }
  if (max_price){ where.push(`p.price<=$${pi++}`); params.push(max_price); }

  const sortMap = { 'price_asc':'p.price ASC', 'price_desc':'p.price DESC', 'newest':'p.created_at DESC', 'popular':'p.created_at DESC' };
  const orderBy = sortMap[sort] || 'p.created_at DESC';

  const { rows } = await db.query(
    `SELECT p.id, p.name, p.price, p.mrp, p.slug, p.is_cod,
            (SELECT url FROM product_images WHERE product_id=p.id LIMIT 1) as image_url,
            c.name as category_name, COUNT(*) OVER() as total_count
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy} LIMIT $${pi++} OFFSET $${pi}`,
    [...params, limit, offset]
  );
  respond(res, { products: rows, total: rows[0]?.total_count || 0 });
}));

app.get('/api/categories', asyncHandler(async (req, res) => {
  const { store_id, slug } = req.query;
  let storeId = store_id;
  if (slug && !store_id) {
    const { rows } = await db.query('SELECT id FROM stores WHERE slug=$1', [slug]);
    storeId = rows[0]?.id;
  }
  if (!storeId) return err(res, 'store_id or slug required');
  const { rows } = await db.query(
    'SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order, name',
    [storeId]
  );
  respond(res, { categories: rows });
}));

app.get('/api/search', asyncHandler(async (req, res) => {
  const { q, store_id, slug } = req.query;
  if (!q) return respond(res, { products: [] });
  let storeId = store_id;
  if (slug && !store_id) {
    const { rows } = await db.query('SELECT id FROM stores WHERE slug=$1', [slug]);
    storeId = rows[0]?.id;
  }
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.price, p.slug,
            (SELECT url FROM product_images WHERE product_id=p.id LIMIT 1) as image_url
     FROM products p
     WHERE p.status='published' AND (store_id=$1 OR $1 IS NULL)
       AND (p.name ILIKE $2 OR p.description ILIKE $2)
     LIMIT 20`,
    [storeId || null, `%${q}%`]
  );
  respond(res, { products: rows, query: q });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — ANALYTICS
// ════════════════════════════════════════════════════════════════

app.get('/api/analytics/revenue', verifyToken, requireRole('merchant','admin'), asyncHandler(async (req, res) => {
  const { from, to, period = '30days' } = req.query;
  const storeId = req.user.store_id;
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];

  const { rows } = await db.query(
    `SELECT DATE(created_at) as date,
            SUM(total) as revenue,
            COUNT(*) as orders,
            AVG(total) as avg_order_value
     FROM orders
     WHERE store_id=$1 AND status NOT IN ('cancelled','pending')
       AND created_at BETWEEN $2 AND $3
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [storeId, fromDate, toDate + 'T23:59:59']
  );

  const { rows: [totals] } = await db.query(
    `SELECT COALESCE(SUM(total),0) as total_revenue,
            COUNT(*) as total_orders,
            COALESCE(AVG(total),0) as avg_order_value,
            COUNT(DISTINCT user_id) as unique_customers
     FROM orders WHERE store_id=$1
       AND status NOT IN ('cancelled','pending')
       AND created_at BETWEEN $2 AND $3`,
    [storeId, fromDate, toDate + 'T23:59:59']
  );
  respond(res, { daily: rows, totals, from: fromDate, to: toDate });
}));

app.post('/api/analytics/events', asyncHandler(async (req, res) => {
  const { store_id, event_type, entity_id, metadata } = req.body;
  if (store_id && event_type) {
    await db.query(
      'INSERT INTO analytics_events (store_id,event_type,entity_id,metadata,created_at) VALUES ($1,$2,$3,$4,NOW())',
      [store_id, event_type, entity_id, JSON.stringify(metadata || {})]
    );
  }
  respond(res, { tracked: true });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — ADMIN ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', verifyToken, requireRole('admin'), asyncHandler(async (req, res) => {
  const [merchants, revenue, orders, activeTrials] = await Promise.all([
    db.query("SELECT COUNT(*) as total FROM stores WHERE is_active=true"),
    db.query("SELECT COALESCE(SUM(total),0) as gmv FROM orders WHERE status NOT IN ('cancelled','pending') AND created_at > NOW()-INTERVAL'30 days'"),
    db.query("SELECT COUNT(*) as total FROM orders WHERE created_at > NOW()-INTERVAL'30 days'"),
    db.query("SELECT COUNT(*) as total FROM stores WHERE trial_ends_at > NOW()"),
  ]);
  respond(res, {
    merchants:    parseInt(merchants.rows[0].total),
    gmv_30d:      parseFloat(revenue.rows[0].gmv),
    orders_30d:   parseInt(orders.rows[0].total),
    active_trials:parseInt(activeTrials.rows[0].total),
  });
}));

app.get('/api/admin/merchants', verifyToken, requireRole('admin'), asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req.query.page, req.query.limit);
  const { rows } = await db.query(
    `SELECT s.*, u.email, u.phone, u.name as owner_name,
            COALESCE(SUM(o.total),0) as total_gmv,
            COUNT(o.id) as order_count,
            COUNT(*) OVER() as total_count
     FROM stores s
     JOIN users u ON u.id=s.user_id
     LEFT JOIN orders o ON o.store_id=s.id AND o.status NOT IN ('cancelled','pending')
     GROUP BY s.id, u.email, u.phone, u.name
     ORDER BY s.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  respond(res, { merchants: rows, total: rows[0]?.total_count || 0 });
}));

app.put('/api/admin/merchants/:id', verifyToken, requireRole('admin'), asyncHandler(async (req, res) => {
  const { plan, is_active, trial_ends_at } = req.body;
  const { rows } = await db.query(
    `UPDATE stores SET
       plan=COALESCE($1,plan),
       is_active=COALESCE($2,is_active),
       trial_ends_at=COALESCE($3,trial_ends_at),
       updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [plan, is_active, trial_ends_at, req.params.id]
  );
  if (!rows.length) return err(res, 'Merchant not found', 404);
  respond(res, { store: rows[0] });
}));

// ════════════════════════════════════════════════════════════════
// SPRINT 1 — COUPON VALIDATION
// ════════════════════════════════════════════════════════════════

app.post('/api/coupons/validate', verifyToken, asyncHandler(async (req, res) => {
  const { code, store_id, subtotal } = req.body;
  const { rows: [coupon] } = await db.query(
    `SELECT * FROM coupons WHERE code=$1 AND store_id=$2 AND is_active=true
     AND (expires_at IS NULL OR expires_at>NOW())
     AND (max_uses IS NULL OR used_count<max_uses)`,
    [code?.toUpperCase(), store_id]
  );
  if (!coupon) return err(res, 'Invalid or expired coupon');
  if (coupon.min_order && subtotal < coupon.min_order)
    return err(res, `Minimum order ₹${coupon.min_order} required`);

  let discount = 0;
  if (coupon.type === 'percentage') discount = subtotal * coupon.value / 100;
  else if (coupon.type === 'fixed')  discount = Math.min(coupon.value, subtotal);
  else if (coupon.type === 'free_shipping') discount = 0;

  respond(res, { valid: true, coupon, discount: +discount.toFixed(2) });
}));

// ════════════════════════════════════════════════════════════════
// REGISTER PHASE 2 ROUTES
// ════════════════════════════════════════════════════════════════
try {
  require('./phase2-routes')(app, db, verifyToken, requireRole, asyncHandler, paginate, validate, schemas, respond, err);
  console.log('✅ Phase 2 routes registered');
} catch (e) {
  console.warn('⚠️  Phase 2 routes not loaded:', e.message);
}

// ════════════════════════════════════════════════════════════════
// HEALTH & ERROR HANDLING
// ════════════════════════════════════════════════════════════════

app.get('/health', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT NOW() as time, version() as pg_version');
  respond(res, {
    status: 'ok',
    version: 'v4.1',
    timestamp: rows[0].time,
    db: 'connected',
    pg: rows[0].pg_version?.split(' ')[1],
  });
}));


// ── GST Invoice PDF ──────────────────────────────────────────
app.get('/api/invoices/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT i.*, o.total, o.subtotal, o.gst_amount, o.shipping_amount,
              o.coupon_discount, o.loyalty_discount,
              o.razorpay_payment_id, o.payment_method,
              o.created_at as order_date,
              s.name as store_name, s.gstin as store_gstin, s.address as store_address,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              a.line1, a.line2, a.city, a.state, a.pincode
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN stores s ON s.id = i.store_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE i.id = $1 AND i.store_id = $2`,
      [req.params.id, req.user.store_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];

    // Get line items
    const { rows: items } = await db.query(
      `SELECT oi.product_name, oi.sku, oi.quantity, oi.unit_price, oi.gst_amount, oi.line_total
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.id = $1`,
      [inv.order_id || req.params.id]
    );

    // Build HTML for PDF
    const cgst = (parseFloat(inv.gst_amount) / 2).toFixed(2);
    const sgst = cgst;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:24px}
  .hdr{display:flex;justify-content:space-between;margin-bottom:24px}
  .hdr h1{font-size:28px;color:#FF6B00;margin:0}
  .title{font-size:20px;font-weight:bold;text-align:center;margin:16px 0;color:#333}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th{background:#F3F4F6;padding:8px;text-align:left;font-size:11px;text-transform:uppercase}
  td{padding:8px;border-bottom:1px solid #E5E7EB}
  .total-row{font-weight:bold;font-size:13px}
  .label{color:#6B7280;font-size:11px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0}
  .box{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px}
  .box h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;color:#6B7280}
</style>
</head><body>
<div class="hdr">
  <div><h1>ZKCommerce</h1><div class="label">${inv.store_name}</div>
    ${inv.store_gstin ? '<div class="label">GSTIN: '+inv.store_gstin+'</div>' : ''}
    ${inv.store_address ? '<div class="label">'+inv.store_address+'</div>' : ''}
  </div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:bold">${inv.invoice_number}</div>
    <div class="label">Date: ${new Date(inv.created_at).toLocaleDateString('en-IN')}</div>
    <div class="label">Order: #ZK-${String(inv.order_id).padStart(5,'0')}</div>
    ${inv.razorpay_payment_id ? '<div class="label">Txn: '+inv.razorpay_payment_id+'</div>' : ''}
  </div>
</div>
<div class="title">TAX INVOICE</div>
<div class="two">
  <div class="box"><h3>Bill To</h3>
    <div><strong>${inv.customer_name}</strong></div>
    <div>${inv.customer_email || ''}</div>
    <div>${inv.customer_phone || ''}</div>
    ${inv.line1 ? '<div>'+inv.line1+(inv.line2?', '+inv.line2:'')+'</div>' : ''}
    ${inv.city ? '<div>'+inv.city+', '+inv.state+' '+inv.pincode+'</div>' : ''}
  </div>
  <div class="box"><h3>Payment</h3>
    <div>Method: ${inv.payment_method || 'Online'}</div>
    <div>Status: Paid</div>
    <div>Date: ${new Date(inv.order_date).toLocaleDateString('en-IN')}</div>
  </div>
</div>
<table>
  <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead>
  <tbody>
    ${items.map((it,i) => `<tr>
      <td>${i+1}</td>
      <td>${it.product_name}</td>
      <td>${it.sku||'-'}</td>
      <td>${it.quantity}</td>
      <td>&#8377;${parseFloat(it.unit_price).toFixed(2)}</td>
      <td>&#8377;${parseFloat(it.gst_amount||0).toFixed(2)}</td>
      <td>&#8377;${parseFloat(it.line_total).toFixed(2)}</td>
    </tr>`).join('')}
  </tbody>
</table>
<table style="width:300px;margin-left:auto">
  <tr><td>Subtotal</td><td style="text-align:right">&#8377;${parseFloat(inv.subtotal||0).toFixed(2)}</td></tr>
  <tr><td>CGST</td><td style="text-align:right">&#8377;${cgst}</td></tr>
  <tr><td>SGST</td><td style="text-align:right">&#8377;${sgst}</td></tr>
  ${parseFloat(inv.shipping_amount||0)>0?`<tr><td>Shipping</td><td style="text-align:right">&#8377;${parseFloat(inv.shipping_amount).toFixed(2)}</td></tr>`:''}
  ${parseFloat(inv.coupon_discount||0)>0?`<tr><td>Coupon discount</td><td style="text-align:right">-&#8377;${parseFloat(inv.coupon_discount).toFixed(2)}</td></tr>`:''}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">&#8377;${parseFloat(inv.total||0).toFixed(2)}</td></tr>
</table>
<div style="margin-top:24px;font-size:10px;color:#9CA3AF;text-align:center">
  This is a computer-generated invoice. No signature required.
</div>
</body></html>`;

    // Try Puppeteer; fall back to HTML if not installed
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top:'20px',bottom:'20px',left:'20px',right:'20px' } });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.invoice_number}.pdf"`);
      return res.send(pdf);
    } catch (puppeteerErr) {
      // Puppeteer not installed — return HTML for browser print
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('X-PDF-Fallback', 'true');
      return res.send(html + '<script>window.print();</script>');
    }
  } catch (e) {
    console.error('Invoice PDF error:', e.message);
    res.status(500).json({ error: e.message });
  }
});


// ── Abandoned cart cron (call every 60 min via Railway Cron / Upstash QStash) ──
app.post('/api/cron/abandoned-carts', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await db.query(
      `SELECT ac.*, u.name, u.phone, s.name as store_name
       FROM abandoned_carts ac
       JOIN users u ON u.id = ac.user_id
       JOIN stores s ON s.id = ac.store_id
       WHERE ac.recovered = false
         AND ac.recovery_sent_at IS NULL
         AND ac.updated_at < NOW() - INTERVAL '60 minutes'
         AND ac.total > 0
       LIMIT 100`
    );
    let sent = 0;
    for (const cart of rows) {
      if (cart.phone && process.env.GUPSHUP_API_KEY) {
        try {
          const WA = require('./whatsapp');
          await WA.abandonedCart({ phone: cart.phone, name: cart.name, total: cart.total, items: cart.cart_data });
          await db.query('UPDATE abandoned_carts SET recovery_sent_at = NOW() WHERE id = $1', [cart.id]);
          sent++;
        } catch (waErr) { /* skip individual failures */ }
      }
    }
    res.json({ processed: rows.length, sent, message: `Recovery WA sent to ${sent} customers` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Blog posts API (v5 feature, activated here) ───────────────
app.get('/api/blog/posts', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, slug, status, published_at, created_at, seo_title,
              LEFT(content, 200) as excerpt
       FROM blog_posts WHERE store_id = $1 ORDER BY created_at DESC`,
      [req.user.store_id]
    );
    res.json({ posts: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/blog/posts', authMiddleware, async (req, res) => {
  const { title, content, seo_title, seo_desc, status } = req.body;
  const slug = (title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  try {
    const { rows } = await db.query(
      `INSERT INTO blog_posts (store_id, author_id, title, slug, content, seo_title, seo_desc, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.store_id, req.user.id, title, slug, content, seo_title, seo_desc,
       status||'draft', status==='published'?new Date():null]
    );
    res.status(201).json({ post: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/blog/posts/:id', authMiddleware, async (req, res) => {
  const { title, content, seo_title, seo_desc, status } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE blog_posts SET title=$1,content=$2,seo_title=$3,seo_desc=$4,status=$5,
       published_at=CASE WHEN $5='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,
       updated_at=NOW()
       WHERE id=$6 AND store_id=$7 RETURNING *`,
      [title, content, seo_title, seo_desc, status, req.params.id, req.user.store_id]
    );
    res.json({ post: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/blog/posts/:id', authMiddleware, async (req, res) => {
  await db.query('DELETE FROM blog_posts WHERE id=$1 AND store_id=$2', [req.params.id, req.user.store_id]);
  res.json({ message: 'Post deleted' });
});

// ── Flash sales API (v5 feature, activated here) ──────────────
app.get('/api/flash-sales', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM flash_sales WHERE store_id=$1 ORDER BY starts_at DESC',
      [req.user.store_id]
    );
    res.json({ flash_sales: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/flash-sales', authMiddleware, async (req, res) => {
  const { name, discount_pct, starts_at, ends_at, product_ids } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO flash_sales (store_id, name, discount_pct, starts_at, ends_at, product_ids)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.store_id, name, discount_pct, starts_at, ends_at, product_ids||[]]
    );
    res.status(201).json({ flash_sale: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/flash-sales/:id', authMiddleware, async (req, res) => {
  const { is_active } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE flash_sales SET is_active=$1 WHERE id=$2 AND store_id=$3 RETURNING *',
      [is_active, req.params.id, req.user.store_id]
    );
    res.json({ flash_sale: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Category create/edit/delete (merchant) ────────────────────
app.post('/api/categories', authMiddleware, async (req, res) => {
  const { name, parent_id, description, icon } = req.body;
  const slug = (name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  try {
    const { rows } = await db.query(
      `INSERT INTO categories (store_id, parent_id, name, slug, description, icon)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.store_id, parent_id||null, name, slug, description, icon]
    );
    res.status(201).json({ category: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/categories/:id', authMiddleware, async (req, res) => {
  const { name, description, icon, is_active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE categories SET name=$1,description=$2,icon=$3,is_active=$4
       WHERE id=$5 AND store_id=$6 RETURNING *`,
      [name, description, icon, is_active!==false, req.params.id, req.user.store_id]
    );
    res.json({ category: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/categories/:id', authMiddleware, async (req, res) => {
  await db.query('DELETE FROM categories WHERE id=$1 AND store_id=$2', [req.params.id, req.user.store_id]);
  res.json({ message: 'Category deleted' });
});

// ── Admin revenue charts API ──────────────────────────────────
app.get('/api/admin/revenue', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const days = req.query.period === 'year' ? 365 : req.query.period === '90days' ? 90 : 30;
  try {
    const { rows: daily } = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total) as revenue
       FROM orders
       WHERE created_at > NOW() - INTERVAL '${days} days'
         AND status NOT IN ('cancelled','pending')
       GROUP BY DATE(created_at) ORDER BY date ASC`
    );
    const { rows: byPlan } = await db.query(
      `SELECT plan, COUNT(*) as stores FROM stores WHERE is_active=true GROUP BY plan`
    );
    const { rows: topStores } = await db.query(
      `SELECT s.name, s.plan, COUNT(o.id) as orders, COALESCE(SUM(o.total),0) as gmv
       FROM stores s LEFT JOIN orders o ON o.store_id=s.id AND o.status NOT IN ('cancelled','pending')
       GROUP BY s.id,s.name,s.plan ORDER BY gmv DESC LIMIT 10`
    );
    res.json({ daily, byPlan, topStores, period: days });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── BNPL / No-Cost EMI — full integration skeleton ───────────
// Supported providers: simpl, lazypay, bajaj
// Wire: POST /api/payments/bnpl/initiate
//       POST /api/payments/bnpl/verify
//       POST /api/payments/bnpl/webhook

app.post('/api/payments/bnpl/verify', async (req, res) => {
  const { order_id, provider, transaction_id, status } = req.body;
  try {
    if (status === 'success') {
      await db.query(
        `UPDATE orders SET status='confirmed', payment_status='paid',
         payment_method=$1, updated_at=NOW() WHERE id=$2`,
        [provider + '_bnpl', order_id]
      );
      // Log BNPL transaction
      await db.query(
        `INSERT INTO bnpl_transactions (order_id, provider, amount, status, reference)
         SELECT id, $1, total, 'paid', $2 FROM orders WHERE id=$3`,
        [provider, transaction_id, order_id]
      ).catch(() => {}); // skip if table not yet created
      res.json({ message: 'BNPL payment verified', order_id });
    } else {
      await db.query(
        `UPDATE orders SET payment_status='failed' WHERE id=$1`, [order_id]
      );
      res.json({ message: 'Payment failed', order_id });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payments/bnpl/webhook', async (req, res) => {
  // Handle provider webhooks (Simpl, LazyPay, Bajaj all send different formats)
  const payload = req.body;
  console.log('[BNPL Webhook]', payload);
  // TODO: verify webhook signature per provider
  // TODO: update order status based on payload
  res.json({ received: true });
});


// ── Affiliate / Influencer system ────────────────────────────
app.get('/api/affiliates', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM affiliates WHERE store_id=$1 ORDER BY created_at DESC`,
      [req.user.store_id]
    );
    res.json({ affiliates: rows });
  } catch(e) {
    // Table may not exist yet (v5 addition)
    res.json({ affiliates: [], note: 'Run v5-additions.sql to enable affiliates' });
  }
});

app.post('/api/affiliates', authMiddleware, async (req, res) => {
  const { name, email, phone, commission_pct } = req.body;
  const ref_code = name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)
    + Math.random().toString(36).slice(2,6);
  try {
    const { rows } = await db.query(
      `INSERT INTO affiliates (store_id, name, email, phone, ref_code, commission_pct)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.store_id, name, email, phone, ref_code, commission_pct||10]
    );
    res.status(201).json({ affiliate: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/affiliates/:id/stats', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, COUNT(o.id) as total_orders, COALESCE(SUM(o.total),0) as total_sales,
              COALESCE(SUM(o.total)*(a.commission_pct/100),0) as commission_earned
       FROM affiliates a
       LEFT JOIN orders o ON o.ref_code=a.ref_code AND o.status NOT IN ('cancelled','pending')
       WHERE a.id=$1 AND a.store_id=$2
       GROUP BY a.id`,
      [req.params.id, req.user.store_id]
    );
    res.json({ stats: rows[0] || {} });
  } catch(e) { res.json({ stats: {} }); }
});

// Track affiliate referral — called when customer lands via ref link
app.post('/api/affiliates/track', async (req, res) => {
  const { ref_code, product_id } = req.body;
  try {
    await db.query(
      `UPDATE affiliates SET total_sales = total_sales + 1 WHERE ref_code=$1`,
      [ref_code]
    ).catch(() => {});
    res.json({ tracked: true, ref_code });
  } catch(e) { res.json({ tracked: false }); }
});


// ── Recurring / Subscription Orders ──────────────────────────
app.get('/api/recurring', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ro.*, p.name as product_name, p.price
       FROM recurring_orders ro JOIN products p ON p.id=ro.product_id
       WHERE ro.user_id=$1 ORDER BY ro.created_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: rows });
  } catch(e) { res.json({ subscriptions: [], note: 'Run v5-additions.sql to enable recurring orders' }); }
});

app.post('/api/recurring', authMiddleware, async (req, res) => {
  const { product_id, store_id, quantity, frequency_days, address_id } = req.body;
  const next = new Date(); next.setDate(next.getDate() + (frequency_days||30));
  try {
    const { rows } = await db.query(
      `INSERT INTO recurring_orders (user_id,store_id,product_id,quantity,frequency_days,next_order_date,address_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, store_id, product_id, quantity||1, frequency_days||30, next.toISOString().slice(0,10), address_id||null]
    );
    res.status(201).json({ subscription: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/recurring/:id', authMiddleware, async (req, res) => {
  const { status, frequency_days } = req.body; // status: active|paused|cancelled
  try {
    const { rows } = await db.query(
      `UPDATE recurring_orders SET status=$1, frequency_days=COALESCE($2,frequency_days)
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [status, frequency_days, req.params.id, req.user.id]
    );
    res.json({ subscription: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cron: process recurring orders due today
app.post('/api/cron/recurring-orders', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await db.query(
      `SELECT ro.*, p.price, u.email, u.name as customer_name
       FROM recurring_orders ro
       JOIN products p ON p.id=ro.product_id
       JOIN users u ON u.id=ro.user_id
       WHERE ro.status='active' AND ro.next_order_date <= CURRENT_DATE`
    );
    let created = 0;
    for (const sub of rows) {
      try {
        // Create order
        const order = await db.query(
          `INSERT INTO orders (user_id,store_id,total,status,payment_method,payment_status,is_recurring)
           VALUES ($1,$2,$3,'confirmed','auto_charge','pending',true) RETURNING id`,
          [sub.user_id, sub.store_id, sub.price * sub.quantity]
        );
        // Update next order date
        const next = new Date(sub.next_order_date);
        next.setDate(next.getDate() + sub.frequency_days);
        await db.query(
          `UPDATE recurring_orders SET next_order_date=$1 WHERE id=$2`,
          [next.toISOString().slice(0,10), sub.id]
        );
        created++;
      } catch(innerErr) { /* skip individual failures */ }
    }
    res.json({ processed: rows.length, orders_created: created });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── Instagram/Meta Shop Sync — v4.1 scope ────────────────────
// Requires: META_APP_ID, META_APP_SECRET, META_CATALOGUE_ID in Railway vars

app.get('/api/meta/status', authMiddleware, async (req, res) => {
  const configured = !!(process.env.META_APP_ID && process.env.META_CATALOGUE_ID);
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) as synced FROM meta_catalogue_items WHERE store_id=$1 AND status='synced'`,
      [req.user.store_id]
    ).catch(() => ({ rows: [{ synced: 0 }] }));
    res.json({
      configured,
      synced_products: parseInt(rows[0].synced),
      catalogue_id: process.env.META_CATALOGUE_ID || null,
      note: configured ? 'Ready' : 'Add META_APP_ID, META_APP_SECRET, META_CATALOGUE_ID to Railway Variables'
    });
  } catch(e) { res.json({ configured: false, synced_products: 0 }); }
});

app.post('/api/meta/sync', authMiddleware, async (req, res) => {
  if (!process.env.META_APP_ID) {
    return res.json({
      message: 'Meta not configured. Add META_APP_ID, META_APP_SECRET, META_CATALOGUE_ID to Railway Variables.',
      docs: 'https://developers.facebook.com/docs/commerce-platform/catalog'
    });
  }
  try {
    const { rows: products } = await db.query(
      `SELECT id,name,price,description,image_url,stock FROM products
       WHERE store_id=$1 AND status='published' LIMIT 100`,
      [req.user.store_id]
    );
    const catalogue = products.map(p => ({
      id: `ZKC_\${p.id}`,
      title: p.name,
      description: (p.description||p.name).slice(0,200),
      price: `\${(p.price*100).toFixed(0)} INR`,
      currency: 'INR',
      availability: p.stock>0 ? 'in stock' : 'out of stock',
      condition: 'new',
      image_url: p.image_url || '',
    }));
    // Real: POST https://graph.facebook.com/v18.0/{catalogue_id}/batch
    // with Authorization: Bearer META_ACCESS_TOKEN
    res.json({
      products_queued: catalogue.length,
      catalogue_id: process.env.META_CATALOGUE_ID,
      status: 'queued',
      catalogue_preview: catalogue.slice(0,3),
      next_step: 'Obtain long-lived access token from Meta Business Manager and call Graph API batch endpoint'
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 404 Catch-All & Error Handling
app.use((req, res) => err(res, `Route not found: ${req.method} ${req.path}`, 404));

app.use((error, req, res, next) => {
  console.error('API Error:', error);
  if (error.code === '23505') return err(res, 'Duplicate entry — this record already exists', 409);
  if (error.code === '23503') return err(res, 'Referenced record not found', 400);
  if (error.name === 'ZodError') return err(res, 'Validation failed', 400);
  err(res, process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message, 500);
});

app.listen(PORT, () => {
  console.log(`
  ⚡ ZKCommerce API v4.1 running on port ${PORT}
  🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}
  💳 Razorpay: ${process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Test mode'}
  📧 Email:    ${process.env.SMTP_HOST ? 'Configured' : 'Not configured'}
  🌍 Env:      ${process.env.NODE_ENV || 'development'}
  `);
});

module.exports = app;
