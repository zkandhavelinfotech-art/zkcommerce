/**
 * ZKCommerce — GoDaddy cPanel / CloudLinux Passenger Startup Entry Point
 * Auto-detects environment, bootstraps Node.js Express server, and binds to process.env.PORT.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Handle uncaught exceptions gracefully so GoDaddy Passenger does not abruptly drop
process.on('uncaughtException', (err) => {
  console.error('[GoDaddy Passenger Error] Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[GoDaddy Passenger Error] Unhandled Rejection:', reason);
});

// Load .env if present
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.production'),
  path.join(__dirname, 'api', '.env')
];
for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    break;
  }
}

// Forward to server module
if (fs.existsSync(path.join(__dirname, 'zkc', 'api', 'server.js'))) {
  module.exports = require('./zkc/api/server.js');
} else if (fs.existsSync(path.join(__dirname, 'zkc-build', 'api', 'server.js'))) {
  module.exports = require('./zkc-build/api/server.js');
} else if (fs.existsSync(path.join(__dirname, 'api', 'server.js'))) {
  module.exports = require('./api/server.js');
} else {
  console.error('❌ Cannot find server.js in zkc/api, zkc-build/api or api directory');
}
