const router = require('express').Router();
const pool = require('../db');
const { checkoutSettings } = require('../services/checkout-settings');
const inventory = require('../services/inventory');
const waSender = require('../services/wa-sender');

router.get('/:slug', async (req,res) => {
  try {
    const cleanSlug = String(req.params.slug || '').toLowerCase().trim().replace(/^www\./, '');
    const {rows} = await pool.query(
      `SELECT s.*,m.name AS merchant_name,m.email AS merchant_email,m.phone AS merchant_phone 
       FROM stores s JOIN merchants m ON m.id=s.merchant_id 
       WHERE (lower(s.slug)=lower($1) 
          OR lower(s.slug)=lower($2)
          OR lower(s.published_snapshot->'store'->>'custom_domain')=lower($1)
          OR lower(s.custom_domain)=lower($1)
          OR regexp_replace(lower(COALESCE(s.custom_domain, '')), '^www\\.', '')=lower($2)
          OR regexp_replace(lower(COALESCE(s.published_snapshot->'store'->>'custom_domain', '')), '^www\\.', '')=lower($2)) 
         AND s.status IN ('published','live') AND s.published_snapshot IS NOT NULL`,
      [req.params.slug, cleanSlug]
    );
    if(!rows.length)return res.status(404).json({error:'Store not found or not published'});
    const s=rows[0],snapshot=s.published_snapshot;
    res.json({store:snapshot.store,theme_config:snapshot.theme_config||{},products:snapshot.products||[],categories:[],pages:snapshot.pages||[],meta:{title:`${s.store_name} — ${s.tagline||'Shop Online'}`,description:s.hero_subtext||''}});
  }catch(e){res.status(500).json({error:e.message});}
});

router.get('/:slug/products', async(req,res)=>{
  try{
    const {page=1,limit=12,category,search,sort='featured'}=req.query,offset=(Number(page)-1)*Number(limit);
    const {rows}=await pool.query(`SELECT published_snapshot FROM stores WHERE (slug=$1 OR lower(published_snapshot->'store'->>'custom_domain')=lower($1)) AND status IN ('published','live') AND published_snapshot IS NOT NULL`,[req.params.slug]);
    if(!rows.length)return res.status(404).json({error:'Store not found'});
    let products=(rows[0].published_snapshot.products||[]).filter(p=>!category||p.category_name===category).filter(p=>!search||p.name.toLowerCase().includes(String(search).toLowerCase()));
    if(sort==='price_asc')products.sort((a,b)=>a.price-b.price);else if(sort==='price_desc')products.sort((a,b)=>b.price-a.price);else products.sort((a,b)=>Number(b.featured)-Number(a.featured)||new Date(b.created_at)-new Date(a.created_at));
    const total=products.length;res.json({products:products.slice(offset,offset+Number(limit)),pagination:{page:Number(page),limit:Number(limit),total}});
  }catch(e){res.status(500).json({error:e.message});}
});

router.get('/:slug/shipping-rates', async(req,res)=>{
  try{
    const {rows:stores}=await pool.query("SELECT id FROM stores WHERE (slug=$1 OR lower(published_snapshot->'store'->>'custom_domain')=lower($1)) AND status IN ('published','live') AND published_snapshot IS NOT NULL",[req.params.slug]);
    if(!stores.length)return res.status(404).json({error:'Store not found'});
    const subtotal=Math.max(0,Number(req.query.subtotal)||0),postal=String(req.query.postal_code||'').replace(/\D/g,'').slice(0,12);
    const {rows}=await pool.query(`SELECT id,name,courier,estimated_days,CASE WHEN free_above IS NOT NULL AND $2>=free_above THEN 0 ELSE rate END AS amount
      FROM store_shipping_rates WHERE store_id=$1 AND active=true AND (postal_prefix IS NULL OR ($3<>'' AND $3 LIKE postal_prefix||'%'))
      ORDER BY (postal_prefix IS NOT NULL) DESC,rate ASC`,[stores[0].id,subtotal,postal]);
    res.json({rates:rows});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/:slug/checkout',async(req,res)=>{
  const client=await pool.connect();
  try{
    const {customer,items,payment_method,address,coupon_code,shipping_rate_id}=req.body;
    if(!customer||!customer.name||!Array.isArray(items)||!items.length||items.length>50)return res.status(400).json({error:'Customer name and 1-50 cart items are required'});
    if(!['cod','razorpay'].includes(payment_method))return res.status(400).json({error:'Choose COD or Razorpay payment'});
    if(customer.email&&!/^\S+@\S+\.\S+$/.test(String(customer.email)))return res.status(400).json({error:'Enter a valid email address'});
    await client.query('BEGIN');
    const {rows:sr}=await client.query(`SELECT id,published_snapshot FROM stores WHERE (slug=$1 OR lower(published_snapshot->'store'->>'custom_domain')=lower($1)) AND status IN ('published','live') AND published_snapshot IS NOT NULL FOR SHARE`,[req.params.slug]);
    if(!sr.length){await client.query('ROLLBACK');return res.status(404).json({error:'Store not found'});}
    const storeId=sr[0].id,products=sr[0].published_snapshot.products||[],lineItems=[];let subtotal=0;
    // Enforce the merchant's published checkout settings, not just the rendered form.
    const checkoutCfg=checkoutSettings(sr[0].published_snapshot.theme_config);
    if(!checkoutCfg[payment_method]){await client.query('ROLLBACK');return res.status(400).json({error:payment_method==='cod'?'Cash on delivery is not available for this store. Please pay online.':'Online payment is not available for this store.'});}
    if(coupon_code&&!checkoutCfg.show_coupon){await client.query('ROLLBACK');return res.status(400).json({error:'Discount codes are not available for this store.'});}
    for(const item of items){
      const p=products.find(x=>String(x.id)===String(item.product_id));
      const quantity=Number(item.quantity);
      if(!p||!Number.isInteger(quantity)||quantity<1||quantity>999){await client.query('ROLLBACK');return res.status(400).json({error:`Product ${item.product_id} not available`});}
      // Variant price comes from the published snapshot (what the shopper saw); stock is checked live below.
      const variant=item.variant_id?inventory.activeVariants(p).find(v=>v.id===String(item.variant_id)):null;
      if(item.variant_id&&!variant){await client.query('ROLLBACK');return res.status(400).json({error:`That size of ${p.name} is no longer available`});}
      if(!variant&&inventory.hasVariants(p)){await client.query('ROLLBACK');return res.status(400).json({error:`Choose a size for ${p.name}`});}
      const price=Number(variant?variant.price:p.price);
      subtotal+=price*quantity;
      lineItems.push({...p,product_id:p.id,price,quantity,variant_id:variant?variant.id:null,variant:variant?variant.label:(item.variant||null),size:variant?variant.label:(p.product_size||null),sku:variant&&variant.sku?variant.sku:p.sku});
    }
    try{await inventory.checkAvailability(client,storeId,lineItems.map(l=>({product_id:l.id,variant_id:l.variant_id,quantity:l.quantity})));}
    catch(stockErr){await client.query('ROLLBACK');return res.status(stockErr.status||409).json({error:stockErr.message});}
    let coupon=null,discount_amount=0;
    if(coupon_code){
      const {rows}=await client.query(`SELECT * FROM coupons WHERE store_id=$1 AND upper(code)=upper($2) AND active=true AND (starts_at IS NULL OR starts_at<=NOW()) AND (expires_at IS NULL OR expires_at>NOW()) AND (usage_limit IS NULL OR used_count<usage_limit) FOR UPDATE`,[storeId,String(coupon_code).trim()]);
      if(!rows.length){await client.query('ROLLBACK');return res.status(400).json({error:'Coupon is invalid, expired, or its usage limit was reached'});}
      coupon=rows[0];
      if(subtotal<Number(coupon.minimum_order)){await client.query('ROLLBACK');return res.status(400).json({error:`This coupon requires a minimum subtotal of ₹${coupon.minimum_order}`});}
      discount_amount=coupon.discount_type==='percent'?Math.round(subtotal*Number(coupon.discount_value)/100):Math.min(subtotal,Number(coupon.discount_value));
    }
    let shipping_amount=0,selectedShippingRate=null;
    if(shipping_rate_id){
      const postal=String(address?.pincode||'').replace(/\D/g,'').slice(0,12);
      const {rows}=await client.query(`SELECT id,rate,free_above FROM store_shipping_rates WHERE id=$1 AND store_id=$2 AND active=true AND (postal_prefix IS NULL OR ($3<>'' AND $3 LIKE postal_prefix||'%')) FOR SHARE`,[shipping_rate_id,storeId,postal]);
      if(!rows.length){await client.query('ROLLBACK');return res.status(400).json({error:'The selected shipping rate is no longer available for this address'});}
      selectedShippingRate=rows[0].id;
      shipping_amount=rows[0].free_above!==null&&subtotal>=Number(rows[0].free_above)?0:Number(rows[0].rate);
    }
    const taxResult=await client.query('SELECT default_rate FROM gst_settings WHERE store_id=$1 AND enabled=true',[storeId]);
    const gst_rate=taxResult.rows.length?Number(taxResult.rows[0].default_rate):0;
    const taxable=Math.max(0,subtotal-discount_amount),gst_amount=Math.round(taxable*gst_rate/100),total_amount=taxable+gst_amount+shipping_amount;
    const orderNum='ZK'+Date.now()+Math.random().toString(36).slice(2,6).toUpperCase();
    const {rows:[order]}=await client.query(`INSERT INTO orders(store_id,order_number,customer_name,customer_email,customer_phone,shipping_address,items,subtotal,discount_amount,gst_rate,gst_amount,shipping_amount,shipping_rate_id,total_amount,coupon_code,payment_method,payment_status,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id,order_number,total_amount,discount_amount,gst_amount,shipping_amount`,
      [storeId,orderNum,String(customer.name).slice(0,150),customer.email||null,customer.phone||null,JSON.stringify(address||{}),JSON.stringify(lineItems),subtotal,discount_amount,gst_rate,gst_amount,shipping_amount,selectedShippingRate,total_amount,coupon?.code||null,payment_method,payment_method==='cod'?'cod':'unpaid',payment_method==='cod'?'confirmed':'pending']);
    for(const item of lineItems)await client.query('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES($1,$2,$3,$4)',[order.id,item.id,item.quantity,item.price]);
    if(coupon)await client.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1',[coupon.id]);
    // COD is confirmed now, so its stock is taken in the same transaction; Razorpay orders take stock once paid.
    const lowStock=payment_method==='cod'?await inventory.deductForOrder(client,order.id):[];
    await client.query('COMMIT');

    // WhatsApp: merchant templates. COD is confirmed now; Razorpay orders get the hand-off link after payment (payments.js).
    let waResults = null, whatsappHandoffUrl = null;
    if (payment_method === 'cod') {
      try {
        const orderMessages = require('../services/order-messages');
        const storeInfo = (sr[0] && sr[0].published_snapshot && sr[0].published_snapshot.store) || sr[0];
        const fullOrder = { ...order, customer_name: customer.name, customer_phone: customer.phone, customer_email: customer.email, shipping_address: address, payment_method: 'cod', payment_status: 'cod', items: lineItems, created_at: new Date() };
        const waSettings = await orderMessages.loadSettings(storeId);
        if (waSettings && waSettings.customer_handoff) whatsappHandoffUrl = orderMessages.linksFor(waSettings, fullOrder, storeInfo).care_url;
        // Customer confirmation + customer-care alert through the store's WhatsApp sender; low-stock alerts to the merchant.
        waResults = await waSender.notifyOrderConfirmed(storeId, { ...fullOrder, id: order.id }, storeInfo);
        waSender.notifyLowStock(storeId, lowStock);
      } catch (waErr) {
        console.warn('[Storefront Checkout] WhatsApp alert warning:', waErr.message);
      }
    }

    res.status(201).json({
      order_id:order.id,
      order_number:order.order_number,
      subtotal,
      discount_amount,
      gst_rate,
      gst_amount,
      shipping_amount,
      total_amount:order.total_amount,
      coupon_code:coupon?.code||null,
      next:payment_method==='razorpay'?'razorpay_checkout':'confirmed',
      whatsapp: waResults,
      whatsapp_handoff_url: whatsappHandoffUrl
    });
  }catch(e){await client.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({error:e.message});}
  finally{client.release();}
});
module.exports=router;
