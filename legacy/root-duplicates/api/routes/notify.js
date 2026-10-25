const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const limiter = require('express-rate-limit')({ windowMs:60*60*1000, max:20, standardHeaders:true, legacyHeaders:false });

router.post('/:slug/contact', limiter, async (req,res) => {
  try {
    const {name,email,phone,reason,message} = req.body;
    if (!name || !message || (!email && !phone)) return res.status(400).json({error:'Name, message, and email or phone are required'});
    if (String(message).length > 5000) return res.status(400).json({error:'Message is too long'});
    const {rows} = await pool.query("SELECT id FROM stores WHERE (slug=$1 OR lower(custom_domain)=lower($1)) AND status IN ('published','live')",[req.params.slug]);
    if(!rows.length) return res.status(404).json({error:'Store not found'});
    await pool.query('INSERT INTO contact_messages(store_id,name,email,phone,reason,message) VALUES($1,$2,$3,$4,$5,$6)',[rows[0].id,String(name).slice(0,150),email||null,phone||null,reason||'general',String(message)]);
    res.status(201).json({message:'Your message has been received'});
  } catch(e){res.status(500).json({error:e.message});}
});

router.post('/:slug/notify', limiter, async (req,res) => {
  try {
    const {email,product_label,product_id} = req.body;
    if(!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'A valid email is required'});
    const {rows} = await pool.query("SELECT id FROM stores WHERE (slug=$1 OR lower(custom_domain)=lower($1)) AND status IN ('published','live')",[req.params.slug]);
    if(!rows.length) return res.status(404).json({error:'Store not found'});
    await pool.query('INSERT INTO notify_requests(store_id,email,product_label) VALUES($1,$2,$3)',[rows[0].id,String(email).slice(0,255),String(product_label||product_id||'Product').slice(0,100)]);
    res.status(201).json({message:'We will notify you when this product is available'});
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/:storeId/messages', auth, async(req,res)=>{
  try{
    const own=await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2',[req.params.storeId,req.user.id]);
    if(!own.rows.length)return res.status(404).json({error:'Store not found'});
    const q=String(req.query.q||'').trim().slice(0,120),status=String(req.query.status||'').trim(),limit=Math.min(200,Math.max(1,Number(req.query.limit)||100));
    if(status&&!['unread','read','resolved'].includes(status))return res.status(400).json({error:'Invalid inbox status'});
    const [messages,notify,counts]=await Promise.all([
      pool.query(`SELECT * FROM contact_messages WHERE store_id=$1 AND ($2='' OR name ILIKE $3 OR email ILIKE $3 OR phone ILIKE $3 OR message ILIKE $3) AND ($4='' OR inbox_status=$4) ORDER BY created_at DESC LIMIT $5`,[req.params.storeId,q,'%'+q+'%',status,limit]),
      pool.query(`SELECT * FROM notify_requests WHERE store_id=$1 AND ($2='' OR email ILIKE $3 OR product_label ILIKE $3) AND ($4='' OR inbox_status=$4) ORDER BY created_at DESC LIMIT $5`,[req.params.storeId,q,'%'+q+'%',status,limit]),
      pool.query(`SELECT (SELECT COUNT(*) FROM contact_messages WHERE store_id=$1 AND inbox_status='unread')::int AS unread_contact,(SELECT COUNT(*) FROM notify_requests WHERE store_id=$1 AND inbox_status='unread')::int AS unread_notify`,[req.params.storeId])
    ]);
    res.json({contact_messages:messages.rows,notify_requests:notify.rows,unread:counts.rows[0]});
  }catch(e){res.status(500).json({error:e.message});}
});

router.patch('/:storeId/messages/:kind/:messageId', auth, async(req,res)=>{
  try{
    const own=await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2',[req.params.storeId,req.user.id]);
    if(!own.rows.length)return res.status(404).json({error:'Store not found'});
    const table=req.params.kind==='contact'?'contact_messages':req.params.kind==='notify'?'notify_requests':null;
    if(!table)return res.status(400).json({error:'Message type must be contact or notify'});
    const status=String(req.body.status||'');
    if(!['unread','read','resolved'].includes(status))return res.status(400).json({error:'Status must be unread, read, or resolved'});
    const {rows}=await pool.query(`UPDATE ${table} SET inbox_status=$1 WHERE id=$2 AND store_id=$3 RETURNING id,inbox_status`,[status,req.params.messageId,req.params.storeId]);
    if(!rows.length)return res.status(404).json({error:'Inbox item not found'});
    res.json({item:rows[0]});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/:storeId/whatsapp-test', auth, async(req,res)=>{
  try{
    const own=await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2',[req.params.storeId,req.user.id]);
    if(!own.rows.length)return res.status(404).json({error:'Store not found'});
    const store=own.rows[0];
    const phone=req.body.phone||store.whatsapp_number;
    if(!phone)return res.status(400).json({error:'Please configure a WhatsApp phone number for this store'});
    const whatsapp=require('../services/whatsapp');
    const result=await whatsapp.sendTestNotification({store,targetPhone:phone});
    res.json({message:'WhatsApp test dispatched',result});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports=router;
