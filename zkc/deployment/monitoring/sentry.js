/**
 * ZKCommerce v4.1 -- Sentry Error Monitoring
 * Include this at the very top of api/server.js
 * Usage: const Sentry = require('./deployment/monitoring/sentry');
 */
'use strict';

const dsn = process.env.SENTRY_DSN;

if (!dsn || dsn.includes('REPLACE')) {
  console.log('[Monitoring] Sentry not configured -- errors go to console only');
  module.exports = {
    init: () => {},
    Handlers: {
      requestHandler: () => (req, res, next) => next(),
      errorHandler:   () => (err, req, res, next) => next(err),
    },
    captureException: (e) => console.error('[Sentry stub]', e.message),
    captureMessage:   (m) => console.log('[Sentry stub]', m),
  };
} else {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: dsn,
      environment: process.env.NODE_ENV || 'development',
      release: 'zkcommerce@4.1.0',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend(event) {
        // Never send secrets to Sentry
        if (event.request && event.request.data) {
          const safe = { ...event.request.data };
          ['password','password_hash','jwt_secret','razorpay_key_secret'].forEach(k => {
            if (safe[k]) safe[k] = '[REDACTED]';
          });
          event.request.data = safe;
        }
        return event;
      },
    });
    console.log('[Monitoring] Sentry enabled --', process.env.NODE_ENV);
    module.exports = Sentry;
  } catch(e) {
    console.warn('[Monitoring] Sentry package not installed -- npm install @sentry/node');
    module.exports = { init: ()=>{}, Handlers: { requestHandler: ()=>(r,s,n)=>n(), errorHandler: ()=>(e,r,s,n)=>n(e) } };
  }
}
