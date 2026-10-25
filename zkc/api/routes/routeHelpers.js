const pool = require('../db');

async function storeFor(req, { body = true } = {}) {
  const requested = Number((body && req.body && req.body.store_id) || req.query.store_id || req.user.store_id);
  if (!Number.isSafeInteger(requested) || requested < 1) return null;
  const admin = req.user.role === 'admin';
  const { rows } = await pool.query(
    `SELECT id,merchant_id,store_name,slug FROM stores WHERE id=$1 AND ($2::boolean OR merchant_id=$3)`,
    [requested, admin, req.user.id]
  );
  return rows[0] || null;
}

function fail(res, error) {
  console.error('[API]', error.message);
  return res.status(500).json({ error: 'Internal server error' });
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

module.exports = { storeFor, fail, positiveId };
