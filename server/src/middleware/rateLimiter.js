const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter: 200 requests per 15 minutes per IP.
 * Applied to all /api routes.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
});

/**
 * Auth rate limiter: 10 attempts per 15 minutes per IP.
 * Prevents brute-force login attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 200 : 10,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Search rate limiter: 30 searches per minute per IP.
 * Prevents API abuse on the product search endpoint.
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    message: 'Too many search requests. Please slow down.',
  },
});

module.exports = { globalLimiter, authLimiter, searchLimiter };
