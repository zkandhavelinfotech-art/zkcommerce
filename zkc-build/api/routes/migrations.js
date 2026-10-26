/**
 * ZKCommerce Database Migration Controller & Endpoints
 * Provides live DB migration status inspection, step-by-step one-by-one execution, and bulk upgrade.
 */
'use strict';
const express = require('express');
const router = express.Router();
const {
  getMigrationStatus,
  migrateNextStep,
  migrateAllPending,
  migrateSpecific,
  MASTER_MIGRATIONS
} = require('../services/db-migrator');

// GET /api/migrations/status — live migration status, last migrated version, and pending list
router.get('/status', async (req, res) => {
  try {
    const status = await getMigrationStatus();
    res.json(status);
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/migrations/step — migrate ONE pending migration step-by-step from the last done
router.post('/step', async (req, res) => {
  try {
    const result = await migrateNextStep();
    res.json(result);
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/migrations/all — migrate all remaining pending migrations
router.post('/all', async (req, res) => {
  try {
    const result = await migrateAllPending();
    res.json(result);
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/migrations/run/:id — run a specific migration by ID or version tag
router.post('/run/:id', async (req, res) => {
  try {
    const result = await migrateSpecific(req.params.id);
    res.json(result);
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
