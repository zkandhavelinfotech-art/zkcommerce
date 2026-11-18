/**
 * ZKCommerce Database Migration Controller & Endpoints
 * Provides live DB migration status inspection, step-by-step one-by-one execution, bulk upgrade,
 * and selective file migration with full audit log and error diagnostics.
 */
'use strict';
const express = require('express');
const router = express.Router();
const {
  getMigrationStatus,
  migrateNextStep,
  migrateAllPending,
  migrateSpecific,
  migrateSelected,
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

// POST /api/migrations/selected — run specific array of selected migration IDs
router.post('/selected', async (req, res) => {
  try {
    const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ success: false, error: 'No migration IDs selected' });
    const result = await migrateSelected(ids);
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
