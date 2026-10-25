/**
 * ZKCommerce v4.1 -- Health Check Script
 * Validates: DB, Redis, API, Razorpay, WhatsApp, R2, Email
 * Usage: node deployment/scripts/health-check.js [environment]
 */
'use strict';

const http   = require('http');
const https  = require('https');
const { Client } = require('pg');
const path   = require('path');
const fs     = require('fs');

// Load env
const env = process.argv[2] || process.env.NODE_ENV || 'development';
const envFile = path.join(__dirname, '../environments', `.env.${env}`);
if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
} else {
  require('dotenv').config();
}

const LOG = {
  pass: (msg) => console.log(`  \x1b[32m[PASS]\x1b[0m ${msg}`),
  fail: (msg) => console.log(`  \x1b[31m[FAIL]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`  \x1b[33m[WARN]\x1b[0m ${msg}`),
  info: (msg) => console.log(`  \x1b[36m[INFO]\x1b[0m ${msg}`),
};

const results = { pass: 0, fail: 0, warn: 0 };

function record(type, label, detail) {
  results[type]++;
  LOG[type](`${label}${detail ? ' -- ' + detail : ''}`);
}

// ── Check 1: Environment Variables ───────────────────────────
function checkEnvVars() {
  console.log('\n\x1b[1mEnvironment Variables\x1b[0m');
  const required = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
  const optional = ['RAZORPAY_KEY_ID', 'GUPSHUP_API_KEY', 'SENTRY_DSN',
                    'SMTP_PASS', 'R2_ACCESS_KEY', 'REDIS_URL'];
  const production_required = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'SENTRY_DSN'];

  required.forEach(function(key) {
    if (!process.env[key]) {
      record('fail', key, 'MISSING -- required for API to start');
    } else if (process.env[key].includes('REPLACE') || process.env[key].includes('placeholder')) {
      record('warn', key, 'placeholder value -- update before using');
    } else {
      record('pass', key, 'set');
    }
  });

  optional.forEach(function(key) {
    if (!process.env[key] || process.env[key].includes('REPLACE')) {
      record('warn', key, 'not configured -- feature will be disabled');
    } else {
      record('pass', key, 'set');
    }
  });

  if (env === 'production') {
    production_required.forEach(function(key) {
      if (!process.env[key] || process.env[key].includes('REPLACE')) {
        record('fail', key, 'REQUIRED for production');
      }
    });
  }
}

// ── Check 2: Database ─────────────────────────────────────────
async function checkDatabase() {
  console.log('\n\x1b[1mDatabase (PostgreSQL)\x1b[0m');
  if (!process.env.DATABASE_URL) {
    record('fail', 'Database', 'DATABASE_URL not set');
    return;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'");
    const tableCount = parseInt(res.rows[0].count);
    if (tableCount >= 30) {
      record('pass', 'Connection', 'connected');
      record('pass', 'Tables', tableCount + ' tables found');
    } else {
      record('warn', 'Tables', `only ${tableCount} tables -- run migration?`);
    }
    // Check key tables
    for (const tbl of ['users', 'stores', 'products', 'orders', 'loyalty_points']) {
      try {
        const t = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
        record('pass', `Table: ${tbl}`, t.rows[0].count + ' rows');
      } catch(e) {
        record('fail', `Table: ${tbl}`, 'missing -- run migration');
      }
    }
    await client.end();
  } catch(e) {
    record('fail', 'Connection', e.message.split('\n')[0]);
    record('info', 'Fix', 'Check DATABASE_URL and ensure PostgreSQL is running');
  }
}

// ── Check 3: API Health ───────────────────────────────────────
async function checkAPI() {
  console.log('\n\x1b[1mAPI Server\x1b[0m');
  const port = process.env.PORT || 3000;
  return new Promise(function(resolve) {
    const req = http.get(`http://localhost:${port}/health`, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok') {
            record('pass', 'API running', `port ${port}`);
            record('pass', 'DB connected', json.db || 'connected');
          } else {
            record('warn', 'API running', 'status: ' + json.status);
          }
        } catch(e) {
          record('warn', 'API response', 'non-JSON response');
        }
        resolve();
      });
    });
    req.on('error', function() {
      record('warn', 'API server', `not running on port ${port} -- start with npm run dev`);
      resolve();
    });
    req.setTimeout(3000, function() {
      record('warn', 'API server', 'timeout -- slow start?');
      req.destroy();
      resolve();
    });
  });
}

// ── Check 4: Node.js version ──────────────────────────────────
function checkRuntime() {
  console.log('\n\x1b[1mRuntime\x1b[0m');
  const nodeVer = process.version;
  const major = parseInt(nodeVer.replace('v', '').split('.')[0]);
  if (major >= 20) {
    record('pass', 'Node.js', nodeVer);
  } else if (major >= 18) {
    record('warn', 'Node.js', nodeVer + ' -- recommend v20 LTS');
  } else {
    record('fail', 'Node.js', nodeVer + ' -- requires v20+');
  }

  // Check npm packages installed
  const nm = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nm)) {
    record('pass', 'node_modules', 'installed');
  } else {
    record('fail', 'node_modules', 'missing -- run npm install');
  }

  // Check package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    record('pass', 'package.json', `version ${pkg.version}`);
    const keyDeps = ['express','pg','bcryptjs','jsonwebtoken','razorpay','zod','helmet'];
    keyDeps.forEach(function(dep) {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        record('pass', dep, pkg.dependencies[dep]);
      } else {
        record('fail', dep, 'missing from package.json');
      }
    });
  } catch(e) {
    record('fail', 'package.json', 'not found or invalid');
  }
}

// ── Check 5: Security ─────────────────────────────────────────
function checkSecurity() {
  console.log('\n\x1b[1mSecurity\x1b[0m');
  const jwt = process.env.JWT_SECRET || '';
  if (jwt.length < 32) {
    record('fail', 'JWT_SECRET', 'too short -- minimum 32 characters');
  } else if (jwt.length >= 64) {
    record('pass', 'JWT_SECRET', 'strong (' + jwt.length + ' chars)');
  } else {
    record('warn', 'JWT_SECRET', 'acceptable but recommend 64+ chars for production');
  }

  if (env === 'production') {
    const rzpKey = process.env.RAZORPAY_KEY_ID || '';
    if (rzpKey.startsWith('rzp_live_')) {
      record('pass', 'Razorpay', 'live keys configured');
    } else if (rzpKey.startsWith('rzp_test_')) {
      record('fail', 'Razorpay', 'test keys in production -- replace with live keys');
    } else {
      record('fail', 'Razorpay', 'not configured');
    }
  } else {
    record('pass', 'Razorpay', env === 'development' ? 'test mode (expected)' : 'check keys');
  }

  if (env === 'production' && process.env.NODE_ENV !== 'production') {
    record('fail', 'NODE_ENV', 'not set to production');
  } else {
    record('pass', 'NODE_ENV', process.env.NODE_ENV || 'not set');
  }
}

// ── Check 6: Disk Space ───────────────────────────────────────
function checkDisk() {
  console.log('\n\x1b[1mFile System\x1b[0m');
  const dbDir   = path.join(process.cwd(), 'database');
  const apiDir  = path.join(process.cwd(), 'api');
  const assDir  = path.join(process.cwd(), 'assets');
  const envEx   = path.join(process.cwd(), '.env.example');
  const sqlFile = path.join(dbDir, 'zkcommerce-master.sql');

  [
    { p: dbDir,   label: 'database/ folder' },
    { p: apiDir,  label: 'api/ folder' },
    { p: assDir,  label: 'assets/ folder' },
    { p: envEx,   label: '.env.example' },
    { p: sqlFile, label: 'zkcommerce-master.sql' },
  ].forEach(function(item) {
    if (fs.existsSync(item.p)) {
      record('pass', item.label, 'exists');
    } else {
      record('fail', item.label, 'missing');
    }
  });

  if (!fs.existsSync(path.join(process.cwd(), '.env'))) {
    record('fail', '.env file', 'missing -- copy from .env.example and configure');
  } else {
    record('pass', '.env file', 'exists');
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  console.log('\x1b[1m\x1b[35m');
  console.log('============================================');
  console.log('  ZKCommerce v4.1 -- Health Check');
  console.log('  Environment: ' + env.toUpperCase());
  console.log('  Time: ' + new Date().toLocaleString('en-IN'));
  console.log('============================================\x1b[0m');

  checkRuntime();
  checkEnvVars();
  checkSecurity();
  checkDisk();
  await checkDatabase();
  await checkAPI();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const total   = results.pass + results.fail + results.warn;
  const pct     = Math.round((results.pass / total) * 100);

  console.log('\n\x1b[1m============================================');
  console.log(`  HEALTH CHECK COMPLETE (${elapsed}s)`);
  console.log(`  Checks: ${total} total`);
  console.log(`  \x1b[32mPASS: ${results.pass}\x1b[1m  \x1b[33mWARN: ${results.warn}\x1b[1m  \x1b[31mFAIL: ${results.fail}\x1b[1m`);
  console.log(`  Score: ${pct}% (${results.fail === 0 ? 'HEALTHY' : results.fail <= 2 ? 'DEGRADED' : 'UNHEALTHY'})`);
  console.log('============================================\x1b[0m\n');

  if (results.fail > 0) {
    console.log('\x1b[31mFailed checks require attention before deployment.\x1b[0m\n');
    process.exit(1);
  }
}

main().catch(function(e) {
  console.error('Health check crashed:', e.message);
  process.exit(1);
});
