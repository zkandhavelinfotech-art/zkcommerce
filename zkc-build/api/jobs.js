/**
 * ZKCommerce Job Queue — BullMQ + Upstash Redis
 * Sprint 3: Background jobs for email, WhatsApp, labels
 */
'use strict';

let Queue, Worker, QueueEvents;
try {
  ({ Queue, Worker, QueueEvents } = require('bullmq'));
} catch {
  console.warn('BullMQ not installed — jobs will run synchronously. Run: npm install bullmq');
}

const connection = process.env.UPSTASH_REDIS_URL
  ? { url: process.env.UPSTASH_REDIS_URL }
  : { host: 'localhost', port: 6379 };

// Create queues
const createQueue = (name) => Queue ? new Queue(name, { connection }) : null;

const queues = {
  email:     createQueue('email'),
  whatsapp:  createQueue('whatsapp'),
  shipping:  createQueue('shipping'),
  reports:   createQueue('reports'),
};

// Job definitions
const jobs = {
  async sendEmail(data) {
    if (queues.email) return queues.email.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    // Fallback: import mailer and send directly
    console.log('[Email job]', data.to, data.subject);
  },

  async sendWhatsApp(data) {
    if (queues.whatsapp) return queues.whatsapp.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 10000 } });
    const WA = require('./whatsapp');
    const fn = WA[data.type];
    if (fn) return fn(data.phone, data.payload).catch(console.error);
  },

  async generateLabel(data) {
    if (queues.shipping) return queues.shipping.add('label', data, { attempts: 2 });
    console.log('[Label job]', data.awb);
  },

  async generateGSTR1(data) {
    if (queues.reports) return queues.reports.add('gstr1', data, { attempts: 2 });
    console.log('[GSTR1 job]', data.store_id, data.month, data.year);
  },
};

// Workers (process in background)
if (Worker && process.env.RUN_WORKERS === 'true') {
  new Worker('email', async (job) => {
    const nodemailer = require('nodemailer');
    const mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await mailer.sendMail(job.data);
  }, { connection, concurrency: 5 });

  new Worker('whatsapp', async (job) => {
    const WA = require('./whatsapp');
    const fn = WA[job.data.type];
    if (fn) await fn(job.data.phone, job.data.payload);
  }, { connection, concurrency: 3 });

  console.log('✅ Background workers started');
}

module.exports = jobs;
