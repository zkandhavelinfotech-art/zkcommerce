const router=require('express').Router(),pool=require('../db'),auth=require('../middleware/auth');
async function storeFor(req){const id=Number((req.body||{}).store_id||req.query.store_id||req.user.store_id);if(!Number.isInteger(id))return null;const {rows}=await pool.query('SELECT id,store_name,gst_number,address,state FROM stores WHERE id=$1 AND merchant_id=$2',[id,req.user.id]);return rows[0]||null;}
function makePdf(lines){
  const clean=s=>String(s||'').normalize('NFKD').replace(/[^\x20-\x7E]/g,' ').replace(/[\\()]/g,'\\$&').slice(0,110);
  const expanded=lines.flatMap(line=>{const text=String(line||'');if(text.length<=92)return [text];const chunks=[];for(let i=0;i<text.length;i+=92)chunks.push(text.slice(i,i+92));return chunks;});
  const pages=[];for(let i=0;i<expanded.length;i+=42)pages.push(expanded.slice(i,i+42));if(!pages.length)pages.push(['Invoice']);
  const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),null,Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')];
  const pageRefs=[];
  pages.forEach((page,index)=>{
    const pageId=4+index*2,contentId=pageId+1;pageRefs.push(`${pageId} 0 R`);
    const text=page.map((line,i)=>`BT /F1 ${index===0&&i===0?16:10} Tf 48 ${790-i*17} Td (${clean(line)}) Tj ET`).join('\n');
    const stream=Buffer.from(text,'ascii');
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`));
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),stream,Buffer.from('\nendstream')]));
  });
  objects[1]=Buffer.from(`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`);
  const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let pos=chunks[0].length;
  objects.forEach((obj,i)=>{offsets.push(pos);const block=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);chunks.push(block);pos+=block.length;});
  const xref=pos;chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));return Buffer.concat(chunks);
}
router.get('/',auth,async(req,res)=>{try{const store=await storeFor(req);if(!store)return res.status(404).json({error:'Store not found'});const q=String(req.query.q||'').trim().slice(0,120),limit=Math.min(100,Math.max(1,Number(req.query.limit)||50)),offset=Math.max(0,Number(req.query.offset)||0);const {rows}=await pool.query(`SELECT i.*,o.order_number,o.customer_name,o.customer_email,o.total_amount FROM invoices i JOIN orders o ON o.id=i.order_id WHERE i.store_id=$1 AND ($2='' OR i.invoice_number ILIKE $3 OR o.order_number ILIKE $3 OR o.customer_name ILIKE $3 OR o.customer_email ILIKE $3) ORDER BY i.issued_at DESC LIMIT $4 OFFSET $5`,[store.id,q,'%'+q+'%',limit,offset]);res.json({invoices:rows,limit,offset,has_more:rows.length===limit});}catch(e){res.status(500).json({error:e.message});}});
router.post('/:orderId',auth,async(req,res)=>{try{const store=await storeFor(req);if(!store)return res.status(404).json({error:'Store not found'});const order=await pool.query("SELECT id,status,payment_method,payment_status FROM orders WHERE id=$1 AND store_id=$2",[req.params.orderId,store.id]);if(!order.rows.length)return res.status(404).json({error:'Order not found'});const o=order.rows[0];if(!['confirmed','processing','shipped','delivered'].includes(o.status)||(!['paid','cod'].includes(o.payment_status)&&!(o.payment_method==='cod'&&o.payment_status==='unpaid')))return res.status(409).json({error:'An invoice can only be issued for a confirmed order'});const {rows:gst}=await pool.query('SELECT enabled,gstin FROM gst_settings WHERE store_id=$1',[store.id]);const settings=gst[0];if(settings?.enabled&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(settings.gstin||store.gst_number||'').toUpperCase()))return res.status(409).json({error:'GST invoicing is enabled, but the store GSTIN is missing or has an invalid format'});const number=`ZK-${store.id}-${req.params.orderId}`;const {rows}=await pool.query('INSERT INTO invoices(store_id,order_id,invoice_number) VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET order_id=EXCLUDED.order_id RETURNING *',[store.id,req.params.orderId,number]);res.status(201).json({invoice:rows[0],gstin_validated:settings?.enabled===true});}catch(e){res.status(500).json({error:e.message});}});
router.get('/:id',auth,async(req,res)=>{try{const store=await storeFor(req);if(!store)return res.status(404).json({error:'Store not found'});const {rows}=await pool.query(`SELECT i.*,o.order_number,o.customer_name,o.customer_email,o.customer_phone,o.shipping_address,o.items,o.subtotal,o.discount_amount,o.gst_rate,o.gst_amount,o.shipping_amount,o.total_amount FROM invoices i JOIN orders o ON o.id=i.order_id WHERE i.id=$1 AND i.store_id=$2`,[req.params.id,store.id]);if(!rows.length)return res.status(404).json({error:'Invoice not found'});res.json({invoice:rows[0]});}catch(e){res.status(500).json({error:e.message});}});
router.get('/:id/pdf',auth,async(req,res)=>{
  try{
    const store=await storeFor(req);if(!store)return res.status(404).json({error:'Store not found'});
    const {rows}=await pool.query(`SELECT i.invoice_number,i.issued_at,o.order_number,o.customer_name,o.customer_email,o.customer_phone,
      o.shipping_address,o.items,o.subtotal,o.discount_amount,o.gst_rate,o.gst_amount,o.shipping_amount,o.total_amount,
      s.store_name,COALESCE(g.gstin,s.gst_number) AS gst_number,s.address,s.state,COALESCE(g.enabled,false) AS gst_enabled
      FROM invoices i JOIN orders o ON o.id=i.order_id JOIN stores s ON s.id=i.store_id
      LEFT JOIN gst_settings g ON g.store_id=s.id WHERE i.id=$1 AND i.store_id=$2`,[req.params.id,store.id]);
    if(!rows.length)return res.status(404).json({error:'Invoice not found'});
    const x=rows[0],gstin=String(x.gst_number||'').toUpperCase();
    if(x.gst_enabled&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))return res.status(409).json({error:'GSTIN is missing or has an invalid format; update store GST settings before downloading this GST invoice'});
    const lines=[`${x.gst_enabled?'Tax Invoice':'Invoice'} ${x.invoice_number}`,`${x.store_name}${x.gst_enabled?' | GSTIN: '+gstin:''}`,`Address: ${x.address||''} ${x.state||''}`,`Date: ${new Date(x.issued_at).toLocaleDateString('en-IN')}`,`Order: ${x.order_number}`,`Bill to: ${x.customer_name||''} | ${x.customer_email||x.customer_phone||''}`,`Shipping address: ${JSON.stringify(x.shipping_address||{})}`,'Items:'];
    (x.items||[]).forEach(item=>lines.push(`${item.name} x ${item.quantity} @ INR ${item.price}`));
    lines.push(`Subtotal: INR ${x.subtotal}`,`Discount: INR ${x.discount_amount||0}`,`Taxable value: INR ${Number(x.subtotal)-Number(x.discount_amount||0)}`,`GST (${x.gst_rate}%): INR ${x.gst_amount}`,`Shipping: INR ${x.shipping_amount||0}`,`Total: INR ${x.total_amount}`);
    const pdf=makePdf(lines);res.type('application/pdf').set('Content-Disposition',`attachment; filename="${x.invoice_number}.pdf"`).send(pdf);
  }catch(e){res.status(500).json({error:e.message});}
});
module.exports=router;
