'use strict';

/**
 * alertController.js — PriceLens Price Alert Management
 *
 * All routes require JWT auth (middleware/auth.js protect).
 *
 * Endpoints:
 *   POST   /api/alerts           — createAlert
 *   GET    /api/alerts           — getUserAlerts
 *   PATCH  /api/alerts/:id       — updateAlert (change targetPrice / cooldown / note)
 *   PATCH  /api/alerts/:id/toggle— toggleAlert (pause / resume)
 *   DELETE /api/alerts/:id       — deleteAlert
 *   POST   /api/alerts/:id/test  — testAlert (manual trigger for dev/debug)
 */

const Alert   = require('../models/Alert');
const Product = require('../models/Product');
const {
  sendPriceDropAlert,
} = require('../services/mailerService');
const logger  = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create Alert
// ─────────────────────────────────────────────────────────────────────────────
const createAlert = async (req, res, next) => {
  try {
    const {
      productId,
      targetPrice,
      targetPctDrop,
      platform     = 'any',
      cooldownHours = 24,
      recurring     = true,
      note,
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }
    if (!targetPrice && !targetPctDrop) {
      return res.status(400).json({
        success: false,
        message: 'At least one of targetPrice or targetPctDrop is required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Capture the current price as baseline for percentage calculations
    const baselinePrice = product.lowestPrice || null;

    if (targetPrice && targetPrice >= (baselinePrice || Infinity)) {
      return res.status(400).json({
        success: false,
        message: `Target price (${targetPrice}) must be below the current price (${baselinePrice})`,
      });
    }

    // ── Prevent duplicate alerts (unique index handles this, but give a nice message) ──
    const existing = await Alert.findOne({
      userId:    req.user._id,
      productId,
      platform,
      isActive:  true,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active alert for this product on this platform',
        alertId: existing._id,
      });
    }

    const alert = await Alert.create({
      userId:        req.user._id,
      productId,
      targetPrice:   targetPrice   || null,
      targetPctDrop: targetPctDrop || null,
      baselinePrice,
      platform,
      cooldownHours: Math.min(Math.max(1, cooldownHours), 168),
      recurring,
      note: note?.trim() || null,
    });

    logger.info(`[AlertController] Alert created: user=${req.user._id} product=${productId}`);

    res.status(201).json({
      success: true,
      message: 'Price alert created. We\'ll notify you by email.',
      alert,
    });
  } catch (err) {
    // Duplicate key error from MongoDB unique index
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You already have an alert for this product on this platform',
      });
    }
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. Get User Alerts
// ─────────────────────────────────────────────────────────────────────────────
const getUserAlerts = async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined; // 'active' | 'triggered' | 'all'
    const filter = { userId: req.user._id };
    if (status === 'active')    filter.isActive  = true;
    if (status === 'triggered') filter.triggered  = true;

    const alerts = await Alert.find(filter)
      .populate('productId', 'title imageUrl lowestPrice bestDealPlatform category')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true }); // include isInCooldown virtual

    // Attach friendly summary to each alert
    const enriched = alerts.map((a) => ({
      ...a,
      currentPrice:    a.productId?.lowestPrice || null,
      savingsToTarget: a.targetPrice && a.productId?.lowestPrice
        ? Math.max(0, a.productId.lowestPrice - a.targetPrice)
        : null,
    }));

    res.json({
      success: true,
      count:   enriched.length,
      alerts:  enriched,
    });
  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 3. Update Alert
// ─────────────────────────────────────────────────────────────────────────────
const updateAlert = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const {
      targetPrice, targetPctDrop,
      cooldownHours, recurring, note,
    } = req.body;

    const alert = await Alert.findOne({ _id: id, userId: req.user._id });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    if (targetPrice   !== undefined) alert.targetPrice   = targetPrice;
    if (targetPctDrop !== undefined) alert.targetPctDrop = targetPctDrop;
    if (cooldownHours !== undefined) alert.cooldownHours = Math.min(Math.max(1, cooldownHours), 168);
    if (recurring     !== undefined) alert.recurring     = recurring;
    if (note          !== undefined) alert.note          = note?.trim() || null;

    // Re-arm the alert if target conditions changed
    if (targetPrice !== undefined || targetPctDrop !== undefined) {
      alert.triggered        = false;
      alert.notificationSent = false;
    }

    await alert.save();
    res.json({ success: true, message: 'Alert updated', alert });
  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. Toggle Alert (pause / resume)
// ─────────────────────────────────────────────────────────────────────────────
const toggleAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, userId: req.user._id });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    alert.isActive = !alert.isActive;
    // When resuming, reset triggered state so it can fire again
    if (alert.isActive) {
      alert.triggered        = false;
      alert.notificationSent = false;
    }
    await alert.save();

    res.json({
      success:  true,
      isActive: alert.isActive,
      message:  alert.isActive ? 'Alert resumed' : 'Alert paused',
      alert,
    });
  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 5. Delete Alert
// ─────────────────────────────────────────────────────────────────────────────
const deleteAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndDelete({
      _id:    req.params.id,
      userId: req.user._id,
    });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    logger.info(`[AlertController] Alert ${alert._id} deleted by user ${req.user._id}`);
    res.json({ success: true, message: 'Alert deleted' });
  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 6. Test Alert (dev/debug — manually fires the notification)
// ─────────────────────────────────────────────────────────────────────────────
const testAlert = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Not available in production' });
    }

    const alert = await Alert.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('productId', 'title lowestPrice sources');

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const bestSource = (alert.productId.sources || []).reduce(
      (prev, curr) => (curr.price > 0 && curr.price < (prev.price || Infinity) ? curr : prev),
      {}
    );

    const emailResult = await sendPriceDropAlert({
      to:           req.user.email,
      userName:     req.user.name,
      productTitle: alert.productId.title,
      targetPrice:  alert.targetPrice || alert.baselinePrice,
      currentPrice: bestSource.price  || alert.productId.lowestPrice,
      platform:     bestSource.platform || 'Amazon',
      productLink:  bestSource.link   || '#',
      savingsAmt:   0,
      savingsPct:   0,
      triggerReason:'This is a test notification from PriceLens.',
    });

    res.json({
      success: true,
      message: 'Test notification sent',
      email:   emailResult,
    });
  } catch (err) {
    next(err);
  }
};


module.exports = {
  createAlert,
  getUserAlerts,
  updateAlert,
  toggleAlert,
  deleteAlert,
  testAlert,
};
