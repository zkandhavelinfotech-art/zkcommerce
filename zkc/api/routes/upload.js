const router = require('express').Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const auth = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req,file,cb) => {
  const ok = ['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(file.mimetype);
  cb(ok ? null : new Error('Only JPEG, PNG, WebP, GIF, and AVIF images are supported'), ok);
} });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key,value,encoding) => crypto.createHmac('sha256',key).update(value).digest(encoding);
function validImageBytes(file) {
  const b=file.buffer;
  if(file.mimetype==='image/jpeg')return b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(file.mimetype==='image/png')return b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(file.mimetype==='image/webp')return b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if(file.mimetype==='image/gif')return b.toString('ascii',0,3)==='GIF';
  if(file.mimetype==='image/avif')return b.length>12&&b.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(b.toString('ascii',8,16));
  return false;
}

const r2Configured = () => ['R2_ACCOUNT_ID','R2_ACCESS_KEY','R2_SECRET_KEY','R2_BUCKET','R2_PUBLIC_URL']
  .every(name => process.env[name] && !/^your_|x{3,}/i.test(process.env[name]));

// Development fallback: without R2 credentials, keep uploads on disk under /assets/uploads.
async function putLocal(file, key) {
  const target = path.join(__dirname, '..', '..', 'assets', 'uploads', ...key.split('/'));
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, file.buffer);
  return `/assets/uploads/${key}`;
}

async function putR2(file, key) {
  const { R2_ACCOUNT_ID:account, R2_ACCESS_KEY:access, R2_SECRET_KEY:secret, R2_BUCKET:bucket, R2_PUBLIC_URL:publicUrl } = process.env;
  if (!r2Configured()) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_UPLOADS !== 'true') throw new Error('R2 storage is not configured');
    return putLocal(file, key);
  }
  const host = `${account}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const url = `https://${host}${path}`;
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g,'');
  const day = now.slice(0,8), payloadHash = hash(file.buffer);
  const headers = { 'content-type':file.mimetype, host, 'x-amz-content-sha256':payloadHash, 'x-amz-date':now };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k].trim()}\n`).join('');
  const canonical = ['PUT',path,'',canonicalHeaders,signedHeaders,payloadHash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${now}\n${scope}\n${hash(canonical)}`;
  const kDate = hmac(`AWS4${secret}`,day), kRegion = hmac(kDate,'auto'), kService = hmac(kRegion,'s3'), kSigning = hmac(kService,'aws4_request');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmac(kSigning,stringToSign,'hex')}`;
  const response = await fetch(url,{ method:'PUT',headers,body:file.buffer });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
  return `${publicUrl.replace(/\/$/,'')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

router.post('/:storeId', auth, upload.single('file'), async (req,res) => {
  try {
    if (!req.file) return res.status(400).json({ error:'An image file is required' });
    if (!validImageBytes(req.file)) return res.status(415).json({error:'The uploaded file does not match its image type'});
    const own = await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2',[req.params.storeId,req.user.id]);
    if (!own.rows.length) return res.status(404).json({ error:'Store not found' });
    const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'})[req.file.mimetype];
    const scope = String(req.body.scope || 'general').replace(/[^a-z0-9_-]/gi,'').slice(0,30) || 'general';
    const key = `stores/${req.params.storeId}/${scope}/${crypto.randomUUID()}.${ext}`;
    const url = await putR2(req.file,key);
    res.status(201).json({ url, key, content_type:req.file.mimetype, size:req.file.size });
  } catch(e) { res.status(e instanceof multer.MulterError ? 400 : 500).json({ error:e.message }); }
});

router.use((err,_req,res,_next) => res.status(err instanceof multer.MulterError ? 400 : 415).json({ error:err.message }));
module.exports = router;
