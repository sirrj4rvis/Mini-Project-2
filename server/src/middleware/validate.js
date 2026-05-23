const { query, param, validationResult } = require('express-validator');

/**
 * Validation Middleware
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses express-validator to sanitize and validate all incoming query params
 * before they reach the controller. Returns consistent 422 errors on failure.
 *
 * Usage in routes:
 *   router.get('/search', searchValidationRules, validate, searchProducts)
 */

/**
 * Middleware that reads the validation result and returns 422 if invalid.
 * Always place this AFTER your validation rule array.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ── Product Search Rules ──────────────────────────────────────────────────────
const searchValidationRules = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query "q" is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Query must be between 1 and 200 characters')
    .escape(), // Prevent XSS

  query('page')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page must be an integer between 1 and 100')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),

  query('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter code (e.g. IN, US)')
    .toUpperCase(),

  query('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters')
    .escape(),

  query('sort')
    .optional()
    .isIn(['relevance', 'price_asc', 'price_desc', 'rating', 'newest'])
    .withMessage('Sort must be one of: relevance, price_asc, price_desc, rating, newest'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minPrice must be a positive number')
    .toFloat(),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxPrice must be a positive number')
    .toFloat(),

  query('platform')
    .optional()
    .isIn(['amazon', 'ebay', 'flipkart', 'walmart', 'any'])
    .withMessage('Platform must be one of: amazon, ebay, flipkart, walmart, any'),
];

// ── Product ID Param Rule ─────────────────────────────────────────────────────
const productIdRule = [
  param('id')
    .trim()
    .isMongoId()
    .withMessage('Invalid product ID format'),
];

// ── Price History Rules ───────────────────────────────────────────────────────
const historyValidationRules = [
  param('id')
    .trim()
    .isMongoId()
    .withMessage('Invalid product ID format'),

  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
    .toInt(),

  query('platform')
    .optional()
    .isIn(['amazon', 'ebay', 'flipkart', 'walmart', 'other', 'all'])
    .withMessage('Invalid platform filter'),
];

// ── Autocomplete Rules ────────────────────────────────────────────────────────
const autocompleteRules = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Query "q" is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Query must be between 1 and 100 characters')
    .escape(),
];

module.exports = {
  validate,
  searchValidationRules,
  productIdRule,
  historyValidationRules,
  autocompleteRules,
};
