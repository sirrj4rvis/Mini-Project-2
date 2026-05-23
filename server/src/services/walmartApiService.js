const axios = require('axios');
const logger = require('../config/logger');
const RetryStrategy = require('./antiblock/retryStrategy');
const { getFallbackData } = require('./api/fallbackData');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'realtime-walmart-data.p.rapidapi.com';

const walmartClient = axios.create({
  baseURL: `https://${RAPIDAPI_HOST}`,
  headers: {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Search Walmart products.
 * @param {string} keyword - Search term
 * @param {number} page  - Page number (1-based)
 * @returns {Array} Array of raw Walmart product objects
 */
const searchWalmartProducts = async (keyword, page = 1) => {
  logger.info(`[WalmartAPI] Searching: "${keyword}" page=${page}`);
  try {
    const response = await RetryStrategy.execute(() => walmartClient.get('/search', {
      params: {
        keyword,
        page,
        sortBy: 'best_match'
      },
    }), { context: 'Walmart Search API', maxRetries: 2 });

    const data = response.data?.results || [];
    logger.info(`[WalmartAPI] Found ${data.length} results for "${keyword}"`);
    return data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      logger.warn(`[WalmartAPI] 429 Quota Exhausted! Injecting fallback mock data for "${keyword}".`);
      return getFallbackData('walmart', keyword) || [];
    }
    throw error;
  }
};

/**
 * Fetch Walmart rollbacks (Deals/Trending).
 * @param {number} page
 * @returns {Array} Array of raw Walmart rollback products, or [] on failure.
 */
const getWalmartRollbacks = async (page = 1) => {
  try {
    const response = await RetryStrategy.execute(() => walmartClient.get('/rollbacks', {
      params: { page },
    }), { context: 'Walmart Rollbacks API', maxRetries: 2 });
    return response.data?.results || [];
  } catch (error) {
    if (error.response?.status === 429) {
      logger.warn('[WalmartAPI] 429 Quota Exhausted on /rollbacks. Returning empty list.');
    } else {
      logger.warn(`[WalmartAPI] /rollbacks failed (${error.message}). Returning empty list.`);
    }
    return [];
  }
};

module.exports = {
  searchWalmartProducts,
  getWalmartRollbacks
};
