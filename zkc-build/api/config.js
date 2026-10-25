const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envArg = process.argv.find(arg => arg.startsWith('--env='));
const aliases = { dev: 'development', staging: 'stage', prod: 'production' };
const requested = String((envArg && envArg.slice('--env='.length)) || process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
const mode = aliases[requested] || requested;
if (!['development','stage','preview','production'].includes(mode)) {
  throw new Error(`Unsupported APP_ENV "${mode}". Use development, stage, preview or production.`);
}

// Keep local secrets in .env and other environments in .env.stage / .env.preview /
// .env.production (or, preferably, the hosting provider's environment settings). Never mix them.
const envFile = mode === 'development' ? '.env' : `.env.${mode}`;
const envPath = path.join(__dirname, '..', envFile);
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else if (mode === 'development') dotenv.config({ path: envPath });

process.env.APP_ENV = mode;
// Stage and preview behave like production for libraries (SSL, caching); APP_ENV keeps the real name.
process.env.NODE_ENV = mode === 'development' ? 'development' : 'production';

module.exports = { mode };
