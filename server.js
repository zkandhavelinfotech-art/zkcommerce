/**
 * ZKCommerce v4.1 — Root Entry Point Proxy
 * For hosting platforms (GoDaddy, cPanel, Cloud) pointing to server.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, 'zkc-build', 'api', 'server.js'))) {
  module.exports = require('./zkc-build/api/server.js');
} else if (fs.existsSync(path.join(__dirname, 'api', 'server.js'))) {
  module.exports = require('./api/server.js');
} else {
  console.error('❌ Cannot find server.js in zkc-build/api or api directory');
}
