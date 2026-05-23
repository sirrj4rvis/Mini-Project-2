/**
 * mlBridgeService.js — Express ↔ Flask ML Integration Layer
 *
 * Architectural responsibilities:
 *   - Maintain a dedicated Axios instance with retry + circuit-breaker semantics
 *   - Normalize all ML payloads sent to Flask
 *   - Normalize all ML responses received from Flask into a consistent shape
 *   - Guarantee graceful fallbacks when the ML service is unavailable
 *   - Cache predictions to avoid hammering the ML service
 *
 * Used by: productController.getPrediction (and alert jobs)
 */

'use strict';

const axios  = require('axios');
const logger = require('../config/logger');
const CacheManager = require('./cache/cacheManager');

// ── Configuration ─────────────────────────────────────────────────────────────
const ML_BASE_URL    = process.env.ML_SERVICE_URL    || 'http://localhost:8000';
const ML_TIMEOUT_MS  = parseInt(process.env.ML_TIMEOUT_MS,  10) || 20_000;
const PRED_CACHE_TTL = parseInt(process.env.ML_CACHE_TTL_S, 10) || 3_600; // 1 hour
const MAX_RETRIES    = 2;

// ── Axios Instance ────────────────────────────────────────────────────────────
const mlClient = axios.create({
  baseURL: ML_BASE_URL,
  timeout: ML_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-Service':    'pricelens-express',
  },
});

// Request interceptor — log every outbound ML call
mlClient.interceptors.request.use((cfg) => {
  logger.info(`[ML Bridge] --> ${cfg.method?.toUpperCase()} ${cfg.baseURL}${cfg.url}`);
  return cfg;
});

// Response interceptor — log round-trip time
mlClient.interceptors.response.use(
  (res) => {
    const ms = res.data?._ms ?? '?';
    logger.info(`[ML Bridge] <-- ${res.status} (${ms}ms)`);
    return res;
  },
  (err) => {
    const status  = err.response?.status   ?? 'ERR';
    const message = err.response?.data?.error ?? err.message;
    logger.error(`[ML Bridge] <-- ${status} ${message}`);
    return Promise.reject(err);
  }
);

// ── Retry helper ──────────────────────────────────────────────────────────────
/**
 * Execute `fn` up to `retries` times with exponential back-off.
 * Only retries on network errors or 5xx responses.
 */
const withRetry = async (fn, retries = MAX_RETRIES) => {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isNetworkOrServer = !err.response || err.response.status >= 500;
      if (!isNetworkOrServer || attempt === retries) throw err;
      const delay = 300 * Math.pow(2, attempt - 1); // 300ms, 600ms
      logger.warn(`[ML Bridge] Retry ${attempt}/${retries} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
};

// ── Payload builders ──────────────────────────────────────────────────────────
/**
 * Normalize a PriceHistory array into the compact format expected by Flask.
 * Filters out entries with invalid or zero prices.
 */
const buildHistoryPayload = (historyDocs) =>
  (historyDocs || [])
    .filter((h) => h.price > 0)
    .map((h) => ({
      date:  h.date instanceof Date
               ? h.date.toISOString().split('T')[0]
               : String(h.date).split('T')[0],
      price: Number(h.price),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

// ── Fallbacks ─────────────────────────────────────────────────────────────────
const PREDICTION_FALLBACK = (reason = 'ML service unavailable.') => ({
  predicted_price:   null,
  confidence:        0,
  trend:             'unknown',
  recommendation:    'WATCH',
  reason,
  price_range:       null,
  days_ahead:        7,
  method:            'fallback',
  ml_available:      false,
});

const RECOMMENDATION_FALLBACK = {
  recommendation:    'WATCH',
  reason:            'Unable to generate a recommendation at this time.',
  confidence:        0,
  savings_potential: 0,
  ml_available:      false,
};

// ── Core Service Methods ───────────────────────────────────────────────────────

/**
 * getPricePrediction
 * Sends product price history to Flask and returns a structured prediction.
 *
 * @param {string} productId   - MongoDB product _id (used as cache key)
 * @param {Array}  history     - Raw PriceHistory documents from MongoDB
 * @param {Object} [meta]      - Optional product metadata to improve accuracy
 * @param {string} [meta.category]
 * @param {string} [meta.platform]
 * @param {number} [meta.mrp]
 * @param {number} [meta.rating]
 * @param {number} [meta.reviewCount]
 * @param {number} [daysAhead=7]
 *
 * @returns {Promise<Object>}  Normalized prediction object
 */
const getPricePrediction = async (
  productId,
  history,
  meta      = {},
  daysAhead = 7,
) => {
  // ── Cache check ──────────────────────────────────────────────────────────
  const cacheKey = `ml:pred:${productId}:${daysAhead}`;
  const cached   = CacheManager.get(cacheKey);
  if (cached) {
    logger.info(`[ML Bridge] Cache hit for product ${productId}`);
    return { ...cached, fromCache: true };
  }

  const historyPayload = buildHistoryPayload(history);

  if (historyPayload.length < 3) {
    return PREDICTION_FALLBACK('Insufficient price history for prediction.');
  }

  try {
    const { data } = await withRetry(() =>
      mlClient.post('/predict', {
        product_id:   productId,
        history:      historyPayload,
        days_ahead:   daysAhead,
        category:     meta.category     || 'Electronics',
        platform:     meta.platform     || 'Amazon',
        mrp:          meta.mrp          || null,
        rating:       meta.rating       || 4.0,
        review_count: meta.reviewCount  || 500,
      })
    );

    const normalized = {
      predicted_price:   data.predicted_price,
      confidence:        data.confidence,
      trend:             data.trend            || 'stable',
      trend_details:     data.trend_details    || null,
      recommendation:    data.recommendation   || 'WATCH',
      reason:            data.reason           || '',
      savings_potential: data.savings_potential|| 0,
      price_change_pct:  data.price_change_pct || 0,
      price_range:       data.price_range      || null,
      current_price:     data.current_price    || null,
      days_ahead:        data.days_ahead       || daysAhead,
      method:            data.method           || 'ml',
      ml_available:      true,
    };

    // Cache successful predictions for 1 hour
    CacheManager.set(cacheKey, normalized, PRED_CACHE_TTL);
    return normalized;

  } catch (err) {
    logger.error(`[ML Bridge] getPricePrediction failed for ${productId}: ${err.message}`);
    return PREDICTION_FALLBACK();
  }
};

/**
 * getRecommendation
 * Asks the Flask service to produce a BUY_NOW / WAIT / WATCH signal
 * given a current price, predicted price, and trend direction.
 *
 * @param {number} currentPrice
 * @param {number} predictedPrice
 * @param {string} trend - 'rising' | 'falling' | 'stable' | 'unknown'
 *
 * @returns {Promise<Object>}
 */
const getRecommendation = async (currentPrice, predictedPrice, trend) => {
  if (!currentPrice || !predictedPrice) return RECOMMENDATION_FALLBACK;

  try {
    const { data } = await withRetry(() =>
      mlClient.post('/recommend', {
        current_price:   Number(currentPrice),
        predicted_price: Number(predictedPrice),
        trend:           trend || 'stable',
      })
    );

    return {
      recommendation:    data.recommendation,
      reason:            data.reason,
      confidence:        data.confidence,
      savings_potential: data.savings_potential || 0,
      price_change_pct:  data.price_change_pct  || 0,
      ml_available:      true,
    };

  } catch (err) {
    logger.error(`[ML Bridge] getRecommendation failed: ${err.message}`);
    return RECOMMENDATION_FALLBACK;
  }
};

/**
 * batchPredict
 * Sends multiple products to Flask's /batch-predict endpoint in a single
 * HTTP call — significantly more efficient than N individual requests.
 *
 * @param {Array<{productId, history, meta, daysAhead}>} items
 * @returns {Promise<Object[]>} Array of normalized predictions (same order)
 */
const batchPredict = async (items) => {
  if (!items?.length) return [];

  const products = items.map((item) => ({
    product_id:   item.productId,
    history:      buildHistoryPayload(item.history),
    days_ahead:   item.daysAhead  || 7,
    category:     item.meta?.category    || 'Electronics',
    platform:     item.meta?.platform    || 'Amazon',
    mrp:          item.meta?.mrp         || null,
    rating:       item.meta?.rating      || 4.0,
    review_count: item.meta?.reviewCount || 500,
  }));

  try {
    const { data } = await withRetry(() =>
      mlClient.post('/batch-predict', { products })
    );

    return (data.results || []).map((r) => ({
      productId:       r.product_id,
      predicted_price: r.predicted_price,
      confidence:      r.confidence,
      trend:           r.trend            || 'stable',
      recommendation:  r.recommendation   || 'WATCH',
      reason:          r.reason           || '',
      ml_available:    !r.error,
      error:           r.error            || null,
    }));

  } catch (err) {
    logger.error(`[ML Bridge] batchPredict failed: ${err.message}`);
    return items.map((item) => ({
      productId:    item.productId,
      ml_available: false,
      error:        'ML service unavailable',
    }));
  }
};

/**
 * getMlServiceStatus
 * Quick health-check — returns true if the Flask service is reachable.
 */
const getMlServiceStatus = async () => {
  try {
    const { data } = await mlClient.get('/health', { timeout: 3000 });
    return {
      available:     data.status === 'ok',
      model_trained: data.model_trained,
      version:       data.version,
    };
  } catch {
    return { available: false, model_trained: false, version: null };
  }
};

/**
 * getModelReport
 * Fetches the last training evaluation report from Flask.
 */
const getModelReport = async () => {
  try {
    const { data } = await mlClient.get('/model/report', { timeout: 5000 });
    return { success: true, report: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getPricePrediction,
  getRecommendation,
  batchPredict,
  getMlServiceStatus,
  getModelReport,
  buildHistoryPayload, // exported for unit tests
};
