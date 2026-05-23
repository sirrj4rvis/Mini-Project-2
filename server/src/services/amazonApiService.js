const axios = require('axios');
const logger = require('../config/logger');
const RetryStrategy = require('./antiblock/retryStrategy');
const { getFallbackData } = require('./api/fallbackData');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'real-time-amazon-data.p.rapidapi.com';

const amazonClient = axios.create({
  baseURL: `https://${RAPIDAPI_HOST}`,
  headers: {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Search Amazon products via Real-Time Amazon Data API.
 * @param {string} query - Search term
 * @param {number} page  - Page number (1-based)
 * @param {string} country - Country code (US, IN, GB, etc.)
 * @returns {Array} Array of raw Amazon product objects
 */
const searchAmazonProducts = async (query, page = 1, country = process.env.DEFAULT_COUNTRY || 'IN') => {
  logger.info(`[AmazonAPI] Searching: "${query}" page=${page} country=${country}`);
  try {
    const response = await RetryStrategy.execute(() => amazonClient.get('/search', {
      params: {
        query,
        page,
        country,
        category_id: 'aps', // All Departments
        sort_by: 'RELEVANCE',
      },
    }), { context: 'Amazon Search API', maxRetries: 2 });

    const data = response.data?.data?.products || [];
    logger.info(`[AmazonAPI] Found ${data.length} results for "${query}"`);
    return data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      logger.warn(`[AmazonAPI] 429 Quota Exhausted! Injecting fallback mock data for "${query}".`);
      return getFallbackData('amazon', query) || [];
    }
    throw error;
  }
};

/**
 * Fetch full product details by ASIN.
 * @param {string} asin - Amazon Standard Identification Number
 * @param {string} country - Country code
 */
const getProductByAsin = async (asin, country = process.env.DEFAULT_COUNTRY || 'IN') => {
  logger.info(`[AmazonAPI] Fetching ASIN: ${asin}`);
  try {
    const response = await RetryStrategy.execute(() => amazonClient.get('/product-details', {
      params: { asin, country },
    }), { context: `Amazon ASIN ${asin}`, maxRetries: 2 });
    return response.data?.data || null;
  } catch (error) {
    // Bug 8 fix: Previously no error handling — any failure was an unhandled rejection.
    logger.error(`[AmazonAPI] getProductByAsin failed for ASIN ${asin}: ${error.response?.data?.message || error.message}`);
    return null;
  }
};

/**
 * Fetch product reviews by ASIN.
 * @param {string} asin
 * @param {string} country
 */
const getProductReviews = async (asin, country = process.env.DEFAULT_COUNTRY || 'IN') => {
  try {
    const response = await RetryStrategy.execute(() => amazonClient.get('/product-reviews', {
      params: { asin, country, page: 1 },
    }), { context: `Amazon Reviews ${asin}`, maxRetries: 2 });
    return response.data?.data?.reviews || [];
  } catch (error) {
    // Bug 8 fix: Previously no error handling.
    logger.error(`[AmazonAPI] getProductReviews failed for ASIN ${asin}: ${error.response?.data?.message || error.message}`);
    return [];
  }
};

/**
 * Fetch product category list.
 * @param {string} country
 */
const getCategoryList = async (country = process.env.DEFAULT_COUNTRY || 'IN') => {
  const response = await RetryStrategy.execute(() => amazonClient.get('/product-category-list', {
    params: { country },
  }), { context: 'Amazon Categories', maxRetries: 2 });
  return response.data?.data?.categories || [];
};

module.exports = {
  searchAmazonProducts,
  getProductByAsin,
  getProductReviews,
  getCategoryList,
};
