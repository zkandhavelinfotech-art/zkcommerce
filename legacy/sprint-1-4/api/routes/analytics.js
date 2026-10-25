const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

router.get('/dashboard', auth, async (req,res) => {
  try {
    const sid = req.user.store_id;
    const [revenue,orders,customers,products,recentOrders,topProducts] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0)::int AS total, COALESCE(SUM(CASE WHEN created_at>=NOW()-interval'30d' THEN total_amount ELSE 0 END),0)::int AS this_month FROM orders WHERE store_id=$1 AND status IN ('confirmed','shipped','delivered')`,[sid]),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(CASE WHEN created_at>=NOW()-interval'30d' THEN 1 END)::int AS this_month FROM orders WHERE store_id=$1`,[sid]),
      pool.query(`SELECT COUNT(DISTINCT customer_email)::int AS total FROM orders WHERE store_id=$1`,[sid]),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(CASE WHEN active THEN 1 END)::int AS active FROM products WHERE store_id=$1`,[sid]),
      pool.query(`SELECT id,order_number,customer_name,total_amount,status,created_at FROM orders WHERE store_id=$1 ORDER BY created_at DESC LIMIT 5`,[sid]),
      pool.query(`SELECT p.id,p.name,p.price,COUNT(oi.id)::int AS sold FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id WHERE p.store_id=$1 GROUP BY p.id ORDER BY sold DESC LIMIT 5`,[sid]),
    ]);
    res.json({
      revenue:revenue.rows[0],
      orders:orders.rows[0],
      customers:customers.rows[0],
      products:products.rows[0],
      recentOrders:recentOrders.rows,
      topProducts:topProducts.rows,
    });
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/revenue', auth, async (req,res) => {
  try {
    const {period='30d'} = req.query;
    const interval = period==='7d'?'7 days':period==='90d'?'90 days':'30 days';
    const {rows} = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS orders, COALESCE(SUM(total_amount),0)::int AS revenue
       FROM orders WHERE store_id=$1 AND created_at>=NOW()-interval'${interval}' AND status!='cancelled'
       GROUP BY DATE(created_at) ORDER BY date`,
      [req.user.store_id]
    );
    res.json({chart:rows,period});
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
