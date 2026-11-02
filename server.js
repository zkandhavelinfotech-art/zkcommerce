/**
 * ZKCommerce — Root Entry Point Proxy
 * Loads environment and boots API server
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Ensure root .env is loaded
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(path.join(__dirname, 'zkc', 'api', 'server.js'))) {
  module.exports = require('./zkc/api/server.js');
} else if (fs.existsSync(path.join(__dirname, 'zkc-build', 'api', 'server.js'))) {
  module.exports = require('./zkc-build/api/server.js');
} else if (fs.existsSync(path.join(__dirname, 'api', 'server.js'))) {
  module.exports = require('./api/server.js');
} else {
  console.error('❌ Cannot find server.js in zkc/api, zkc-build/api or api directory');
}
