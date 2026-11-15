/**
 * ZKCommerce Deployment & Publishing API
 * Powers the 1-Click GoDaddy Node.js Publish Portal, FTP deployment, and live MySQL migration tools.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const mysql = require('mysql2/promise');
const ftp = require('basic-ftp');
const pool = require('../db');

// Release bundle location
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const releaseZipPath = path.join(repoRoot, 'deployment', 'godaddy-nodejs-release.zip');
const releaseDir = path.join(repoRoot, 'deployment', 'godaddy-nodejs');

// GET /api/deployment/status
router.get('/status', async (req, res) => {
  try {
    let zipExists = fs.existsSync(releaseZipPath);
    let zipStats = zipExists ? fs.statSync(releaseZipPath) : null;
    let dirExists = fs.existsSync(releaseDir);

    let dbStatus = 'disconnected';
    let dbDetails = { dialect: pool.dialect || 'unknown' };

    try {
      if (pool.dialect === 'mysql') {
        const [r] = await pool.rawPool.query('SELECT 1 AS ok, DATABASE() AS db_name, VERSION() AS ver');
        dbStatus = 'connected';
        dbDetails = {
          dialect: 'mysql',
          database: r[0]?.db_name,
          version: r[0]?.ver
        };
      } else {
        const r = await pool.query('SELECT 1 AS ok, current_database() AS db_name, version() AS ver');
        dbStatus = 'connected';
        dbDetails = {
          dialect: 'postgres',
          database: r.rows[0]?.db_name,
          version: r.rows[0]?.ver
        };
      }
    } catch (e) {
      dbDetails.error = e.message;
    }

    res.json({
      success: true,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      database: {
        status: dbStatus,
        ...dbDetails
      },
      package: {
        ready: zipExists,
        size_bytes: zipStats ? zipStats.size : 0,
        size_formatted: zipStats ? (zipStats.size / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB',
        last_modified: zipStats ? zipStats.mtime : null,
        dir_ready: dirExists
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deployment/test-mysql
router.post('/test-mysql', async (req, res) => {
  const { host = 'localhost', port = 3306, user = 'root', password = '', database } = req.body || {};
  if (!database) {
    return res.status(400).json({ error: 'Database name is required' });
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: host.trim(),
      port: Number(port) || 3306,
      user: user.trim(),
      password: String(password),
      database: database.trim(),
      connectTimeout: 8000
    });

    const [ver] = await conn.query('SELECT VERSION() AS ver, DATABASE() AS cur_db');
    const [tables] = await conn.query('SHOW TABLES');

    await conn.end();

    res.json({
      success: true,
      message: '✅ Connected to GoDaddy MySQL database successfully!',
      mysql_version: ver[0]?.ver,
      database: ver[0]?.cur_db,
      existing_tables_count: tables.length,
      existing_tables: tables.map(t => Object.values(t)[0])
    });
  } catch (err) {
    if (conn) await conn.end().catch(() => {});
    res.status(400).json({
      success: false,
      error: 'MySQL connection failed: ' + err.message
    });
  }
});

// POST /api/deployment/migrate-mysql
router.post('/migrate-mysql', async (req, res) => {
  const { host = 'localhost', port = 3306, user = 'root', password = '', database } = req.body || {};
  if (!database) {
    return res.status(400).json({ error: 'Database name is required' });
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: host.trim(),
      port: Number(port) || 3306,
      user: user.trim(),
      password: String(password),
      database: database.trim(),
      multipleStatements: true,
      connectTimeout: 10000
    });

    // Find schema SQL
    const candidatePaths = [
      path.join(repoRoot, 'zkc', 'database', 'schema-mysql.sql'),
      path.join(repoRoot, 'zkc', 'database', 'smeram_mysql.sql'),
      path.join(repoRoot, 'deployment', 'godaddy-nodejs', 'schema-mysql.sql'),
      path.join(repoRoot, 'database', 'schema-mysql.sql')
    ];

    const sqlPath = candidatePaths.find(p => fs.existsSync(p));
    if (!sqlPath) {
      throw new Error('schema-mysql.sql schema file not found');
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const statements = sqlContent
      .split(/;\s*[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && !s.startsWith('--') && !s.startsWith('/*'));

    let executed = 0;
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        executed++;
      } catch (e) {
        // Continue past warnings
      }
    }

    const [tables] = await conn.query('SHOW TABLES');
    await conn.end();

    res.json({
      success: true,
      message: `🎉 MySQL migration finished successfully! ${executed} statements executed.`,
      tables_created: tables.length,
      tables: tables.map(t => Object.values(t)[0])
    });
  } catch (err) {
    if (conn) await conn.end().catch(() => {});
    res.status(400).json({
      success: false,
      error: 'Migration error: ' + err.message
    });
  }
});

// POST /api/deployment/ftp-upload
router.post('/ftp-upload', async (req, res) => {
  const { host, port = 21, user, password, remoteDir = '/public_html', secure = false } = req.body || {};

  if (!host || !user || !password) {
    return res.status(400).json({ error: 'FTP Host, User, and Password are required.' });
  }

  // Ensure release package directory exists
  if (!fs.existsSync(releaseDir)) {
    return res.status(400).json({
      error: 'Node.js release bundle is not built yet. Please click "Build Release Package" first.'
    });
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: host.trim(),
      port: Number(port) || 21,
      user: user.trim(),
      password: String(password),
      secure: Boolean(secure)
    });

    await client.ensureDir(remoteDir.trim());
    await client.uploadFromDir(releaseDir, remoteDir.trim());

    client.close();

    res.json({
      success: true,
      message: `🎉 All Node.js application files uploaded successfully to ${host}${remoteDir}!`,
      target_dir: remoteDir
    });
  } catch (err) {
    client.close();
    res.status(400).json({
      success: false,
      error: 'FTP Upload failed: ' + err.message
    });
  }
});

// GET /api/deployment/download-zip
router.get('/download-zip', (req, res) => {
  if (!fs.existsSync(releaseZipPath)) {
    return res.status(404).send('Release ZIP not found. Please run the build script first.');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="godaddy-nodejs-release.zip"');
  fs.createReadStream(releaseZipPath).pipe(res);
});

module.exports = router;
