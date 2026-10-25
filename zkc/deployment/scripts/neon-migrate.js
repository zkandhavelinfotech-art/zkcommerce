// Usage: node deployment/scripts/neon-migrate.js "postgresql://...?sslmode=require"
const fs = require('fs'); const path = require('path');
const { Client } = require('pg'); require('dotenv').config();
(async () => {
  let url = process.argv[2] || process.env.DATABASE_URL || '';
  url = url.replace(/^DATABASE_URL=/, '').replace(/^['"]|['"]$/g, '');
  if (!url) { console.error('No DATABASE_URL given'); process.exit(1); }
  let local = false;
  try { local = ['localhost','127.0.0.1','::1'].includes(new URL(url).hostname); } catch (_) {}
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect(); console.log('Connected');
  const sql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
  await c.query(sql); console.log('Schema applied');
  await c.end();
})().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
