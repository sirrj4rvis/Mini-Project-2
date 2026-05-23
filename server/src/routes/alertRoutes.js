'use strict';

const express = require('express');
const {
  createAlert,
  getUserAlerts,
  updateAlert,
  toggleAlert,
  deleteAlert,
  testAlert,
} = require('../controllers/alertController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All alert routes require a valid JWT
router.use(protect);

// ── Collection routes ────────────────────────────────────────────────────────
// GET  /api/alerts?status=active|triggered|all
router.get('/',    getUserAlerts);
// POST /api/alerts
router.post('/',   createAlert);

// ── Member routes ────────────────────────────────────────────────────────────
// PATCH  /api/alerts/:id         — update targetPrice / cooldown / note
router.patch('/:id',        updateAlert);
// PATCH  /api/alerts/:id/toggle  — pause or resume
router.patch('/:id/toggle', toggleAlert);
// DELETE /api/alerts/:id
router.delete('/:id',       deleteAlert);
// POST   /api/alerts/:id/test    — fire a test email (dev only)
router.post('/:id/test',    testAlert);

module.exports = router;

