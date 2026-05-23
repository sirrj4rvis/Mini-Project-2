const express = require('express');
const {
  searchProducts,
  getProductById,
  getPriceHistory,
  compareProduct,
  getPrediction,
  getRedirectUrl,
  getTrendingProducts,
  getAutocomplete,
  toggleWatchlist,
  getAmazonReviews,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  searchValidationRules,
  productIdRule,
  historyValidationRules,
  autocompleteRules,
} = require('../middleware/validate');

const router = express.Router();

/**
 * Public Routes (no auth needed)
 * ──────────────────────────────────────────────────────────────────────────────
 */

// GET /api/products/trending?limit=12
router.get('/trending', getTrendingProducts);

// GET /api/products/autocomplete?q=iph
router.get('/autocomplete', autocompleteRules, validate, getAutocomplete);

// GET /api/products/search?q=laptop&page=1&sort=price_asc&category=Electronics
//                         &minPrice=500&maxPrice=50000&platform=amazon
router.get('/search', searchLimiter, searchValidationRules, validate, searchProducts);

// GET /api/products/:id
router.get('/:id', productIdRule, validate, getProductById);

// GET /api/products/:id/amazon-reviews
router.get('/:id/amazon-reviews', productIdRule, validate, getAmazonReviews);

// GET /api/products/:id/history?days=30&platform=amazon
router.get('/:id/history', historyValidationRules, validate, getPriceHistory);

// GET /api/products/:id/compare
router.get('/:id/compare', productIdRule, validate, compareProduct);

// GET /api/products/:id/predict
router.get('/:id/predict', productIdRule, validate, getPrediction);

// GET /api/products/:id/redirect?platform=ebay
router.get('/:id/redirect', productIdRule, validate, getRedirectUrl);

/**
 * Protected Routes (JWT required)
 * ──────────────────────────────────────────────────────────────────────────────
 */

// POST /api/products/:id/watchlist
router.post('/:id/watchlist', protect, productIdRule, validate, toggleWatchlist);

module.exports = router;
