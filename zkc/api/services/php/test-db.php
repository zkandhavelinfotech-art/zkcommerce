<?php
/**
 * ZKCommerce — Database Connection Diagnostic & Testing Console
 * -------------------------------------------------------------
 * Tests MySQL connectivity from db_config.php and inspects tables & records.
 * Can be run in browser (HTML) or via API (?json=1 or Accept: application/json).
 */

$isJson = (isset($_GET['json']) && $_GET['json'] == '1') || 
          (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

$startTime = microtime(true);
$configFileExists = is_file(__DIR__ . '/db_config.php');

$error = null;
$pdo = null;
$dbHost = '';
$dbPort = 3306;
$dbName = '';
$dbUser = '';
$serverInfo = [];
$tables = [];
$tableStats = [];

if ($configFileExists) {
    require_once __DIR__ . '/db_config.php';
    $dbHost = defined('DB_HOST') ? DB_HOST : 'localhost';
    $dbPort = defined('DB_PORT') ? DB_PORT : 3306;
    $dbName = defined('DB_NAME') ? DB_NAME : '';
    $dbUser = defined('DB_USER') ? DB_USER : '';
    
    $pdo = getDbConnection();
    if (!$pdo) {
        $error = function_exists('getDbConnectionError') ? getDbConnectionError() : ($GLOBALS['zkc_db_error'] ?? 'Could not establish PDO MySQL connection.');
    } else {
        try {
            $verStmt = $pdo->query("SELECT VERSION() AS ver, DATABASE() AS cur_db, @@time_zone AS tz, CURRENT_TIMESTAMP AS now_ts");
            $serverInfo = $verStmt->fetch(PDO::FETCH_ASSOC);

            $tblStmt = $pdo->query("SHOW TABLES");
            $tables = $tblStmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($tables as $t) {
                try {
                    $cntStmt = $pdo->query("SELECT COUNT(*) FROM `" . str_replace('`', '``', $t) . "`");
                    $tableStats[$t] = (int)$cntStmt->fetchColumn();
                } catch (Exception $e) {
                    $tableStats[$t] = 'error';
                }
            }
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
} else {
    $error = "db_config.php not found in " . __DIR__ . ". Copy db_config.example.php to db_config.php.";
}

$latencyMs = round((microtime(true) - $startTime) * 1000, 2);

if ($isJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => $pdo ? 'connected' : 'error',
        'connected' => $pdo !== null,
        'latency_ms' => $latencyMs,
        'config_file_found' => $configFileExists,
        'database' => [
            'host' => $dbHost,
            'port' => $dbPort,
            'name' => $dbName,
            'user' => $dbUser ? substr($dbUser, 0, 3) . '***' : ''
        ],
        'server' => $serverInfo,
        'tables_count' => count($tables),
        'tables' => $tableStats,
        'error' => $error,
        'timestamp' => date('c')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZKCommerce Database Connection Test · <?php echo htmlspecialchars($dbName ?: 'MySQL'); ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --success: #10b981;
      --error: #ef4444;
      --accent: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 30px 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-badge {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #0284c7, #10b981);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .nav-links {
      display: flex;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
    }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; color: #fff; }

    .status-card {
      background: var(--card-bg);
      border: 2px solid <?php echo $pdo ? 'var(--success)' : 'var(--error)'; ?>;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .status-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .status-title {
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      color: <?php echo $pdo ? '#34d399' : '#f87171'; ?>;
    }
    .pill {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 600;
      background: rgba(255,255,255,0.08);
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .stat-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .stat-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .stat-val {
      font-size: 14px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
      word-break: break-all;
    }

    .error-box {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 10px;
      padding: 16px;
      color: #fca5a5;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--muted);
      font-weight: 600;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(15, 23, 42, 0.5);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .guide-step {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      font-size: 13.5px;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .step-num {
      width: 24px;
      height: 24px;
      background: #334155;
      color: #38bdf8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 11px;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-badge">🔌</div>
        <div>
          <h1 style="font-size:18px;font-weight:700">ZKCommerce MySQL Connection Tester</h1>
          <p style="font-size:12px;color:var(--muted)">db_config.php diagnostic console</p>
        </div>
      </div>
      <div class="nav-links">
        <a href="test-db.php" class="btn btn-primary">⚡ Re-test Connection</a>
        <a href="swagger.html" class="btn">📚 Swagger API Console</a>
        <a href="test-db.php?json=1" target="_blank" class="btn">JSON Output</a>
      </div>
    </div>

    <!-- Status Banner -->
    <div class="status-card">
      <div class="status-header">
        <div class="status-title">
          <span><?php echo $pdo ? '✅ MySQL Database Connected' : '❌ Database Connection Failed'; ?></span>
        </div>
        <div class="pill">Latency: <?php echo $latencyMs; ?> ms</div>
      </div>

      <div class="grid">
        <div class="stat-box">
          <div class="stat-label">Host</div>
          <div class="stat-val"><?php echo htmlspecialchars($dbHost . ':' . $dbPort); ?></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Database Name</div>
          <div class="stat-val"><?php echo htmlspecialchars($dbName ?: '(empty)'); ?></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Database User</div>
          <div class="stat-val"><?php echo htmlspecialchars($dbUser ? substr($dbUser, 0, 3) . '***' : '(empty)'); ?></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">MySQL Version</div>
          <div class="stat-val"><?php echo htmlspecialchars($serverInfo['ver'] ?? 'Unknown'); ?></div>
        </div>
      </div>

      <?php if ($error): ?>
        <div class="error-box">
          <strong>Connection Error:</strong><br>
          <?php echo htmlspecialchars($error); ?>
        </div>
      <?php else: ?>
        <p style="color:#34d399;font-size:13px;font-weight:500">
          ✓ Connected successfully to <b><?php echo htmlspecialchars($dbName); ?></b>. All PHP endpoints (<code>api.php</code>, <code>order.php</code>) can interact with MySQL.
        </p>
      <?php endif; ?>
    </div>

    <?php if ($pdo): ?>
      <!-- Tables & Row Counts -->
      <div class="card">
        <div class="card-title">
          <span>Database Tables (<?php echo count($tables); ?> found)</span>
          <span style="font-size:12px;color:var(--muted)">Timezone: <?php echo htmlspecialchars($serverInfo['tz'] ?? '+00:00'); ?></span>
        </div>

        <?php if (!empty($tables)): ?>
          <table>
            <thead>
              <tr>
                <th>Table Name</th>
                <th>Records</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($tables as $t): ?>
                <tr>
                  <td><code><?php echo htmlspecialchars($t); ?></code></td>
                  <td><strong><?php echo is_int($tableStats[$t]) ? number_format($tableStats[$t]) : 'N/A'; ?></strong></td>
                  <td><span style="color:#34d399;font-weight:600">✓ Ready</span></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php else: ?>
          <p style="color:#f59e0b;font-size:13px;padding:10px 0">
            ⚠️ Connected, but 0 tables found in <b><?php echo htmlspecialchars($dbName); ?></b>. Import <code>smeram_mysql.sql</code> in phpMyAdmin to create the tables.
          </p>
        <?php endif; ?>
      </div>
    <?php else: ?>
      <!-- Troubleshooting Guide for GoDaddy cPanel / Plesk -->
      <div class="card">
        <div class="card-title">
          <span>How to Fix Database Connection on GoDaddy</span>
        </div>
        <div class="guide-step">
          <div class="step-num">1</div>
          <div>
            <strong>Confirm Database &amp; User in cPanel:</strong><br>
            In GoDaddy cPanel &rarr; <i>MySQL Databases</i>, check that your database name and user match exactly. Note that GoDaddy often prefixes them with your cPanel username (e.g. <code>myuser_smeram</code>).
          </div>
        </div>
        <div class="guide-step">
          <div class="step-num">2</div>
          <div>
            <strong>Verify User Permissions:</strong><br>
            Under <i>Add User To Database</i>, make sure you assigned the user to the database and checked <b>ALL PRIVILEGES</b>.
          </div>
        </div>
        <div class="guide-step">
          <div class="step-num">3</div>
          <div>
            <strong>Update db_config.php:</strong><br>
            Edit <code>db_config.php</code> in your site root or File Manager with the exact database credentials.
          </div>
        </div>
        <div class="guide-step">
          <div class="step-num">4</div>
          <div>
            <strong>Import Schema in phpMyAdmin:</strong><br>
            Open phpMyAdmin, click your database on the left, click <i>Import</i>, and upload <code>smeram_mysql.sql</code>.
          </div>
        </div>
      </div>
    <?php endif; ?>

    <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:20px">
      ZKCommerce Storefront Engine · Smeram Naturals · © 2026
    </div>
  </div>
</body>
</html>
