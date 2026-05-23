/**
 * mlRoutes.js — ML Service Admin & Status Routes
 *
 * Mounted at: /api/ml
 *
 * Routes:
 *   GET  /api/ml/health           — Flask ML service health probe
 *   GET  /api/ml/model/report     — Last training evaluation report
 *   POST /api/ml/batch-predict    — Batch price prediction (up to 50 products)
 *
 * Note: batch-predict and model/report are admin-protected in production.
 *       Set ADMIN_KEY in .env and pass it as x-admin-key header.
 */

'use strict';

const express = require('express');
const {
  getMlServiceStatus,
  getModelReport,
  batchPredict,
  buildHistoryPayload,
} = require('../services/mlBridgeService');
const PriceHistory = require('../models/PriceHistory');
const Product      = require('../models/Product');
const logger       = require('../config/logger');

const router = express.Router();

// ── Lightweight admin key guard (not full JWT — for internal tooling) ─────────
const adminGuard = (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return next(); // Skip if not configured
  const provided = req.headers['x-admin-key'];
  if (provided !== adminKey) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

// ── GET /api/ml/health ────────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const status = await getMlServiceStatus();
  return res.status(status.available ? 200 : 503).json({
    success: status.available,
    ...status,
  });
});

// ── GET /api/ml/model/report ──────────────────────────────────────────────────
router.get('/model/report', adminGuard, async (req, res, next) => {
  try {
    const result = await getModelReport();
    if (!result.success) {
      return res.status(503).json({ success: false, message: result.error });
    }
    res.json({ success: true, report: result.report });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ml/batch-predict ────────────────────────────────────────────────
// Body: { "productIds": ["id1", "id2", ...], "daysAhead": 7 }
router.post('/batch-predict', adminGuard, async (req, res, next) => {
  try {
    const { productIds, daysAhead = 7 } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'productIds array required' });
    }
    if (productIds.length > 50) {
      return res.status(400).json({ success: false, message: 'Maximum 50 products per batch' });
    }

    // Fetch all products and their histories in parallel
    const [products, allHistory] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).lean(),
      PriceHistory.find({ productId: { $in: productIds } })
        .sort({ timestamp: 1 })
        .select('productId price platform timestamp -_id')
        .lean(),
    ]);

    // Group history by productId
    const historyByProduct = allHistory.reduce((acc, h) => {
      const key = h.productId.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(h);
      return acc;
    }, {});

    // Build batch payload items
    const items = products.map((product) => {
      const productHistory = historyByProduct[product._id.toString()] || [];
      const bestSource     = (product.sources || []).reduce(
        (prev, curr) => (curr.price > 0 && curr.price < (prev.price || Infinity) ? curr : prev),
        {}
      );
      return {
        productId:  product._id.toString(),
        history:    productHistory,
        daysAhead,
        meta: {
          category:    product.category       || 'Electronics',
          platform:    bestSource.platform    || 'Amazon',
          mrp:         product.highestPrice   || null,
          rating:      bestSource.rating      || 4.0,
          reviewCount: bestSource.reviewCount || 500,
        },
      };
    });

    logger.info(`[ML Routes] Batch predicting ${items.length} products`);
    const results = await batchPredict(items);

    res.json({
      success: true,
      count:   results.length,
      results,
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
