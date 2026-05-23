const searchCache = require('./searchCache.service');
const productHistory = require('./productHistory.service');
const logger = require('../shared/logger');
const NodeCache = require('node-cache');

const memoryCache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_TTL_SEARCH, 10) || 300,
  checkperiod: 60,
  useClones: false,
  deleteOnExpire: true,
});

memoryCache.on('expired', (key) => {
  logger.debug(`[CacheManager] Expired: ${key}`);
});


/**
 * High-level orchestration manager for caching and history.
 * Designed to sit between the Aggregator and the Database to provide a clean API.
 */
class CacheManager {
  
  /**
   * Checks if a valid, unexpired search cache exists.
   * @param {string} query 
   * @returns {Array|null} Unified products
   */
  static async getCachedResults(query) {
    return await searchCache.getCachedSearch(query);
  }

  /**
   * Primary write operation. 
   * 1. Caches search results for instant subsequent responses.
   * 2. Silently records chronological price points for ML predictions.
   * 
   * @param {string} query 
   * @param {Array} unifiedResults - Fully aggregated & deduplicated products
   */
  static async saveResults(query, unifiedResults) {
    if (!unifiedResults || unifiedResults.length === 0) return;

    // 1. Cache the search query (Awaited to ensure consistency)
    await searchCache.cacheSearchResults(query, unifiedResults);

    // 2. Track historical prices after cache write so callers do not outlive DB work.
    await productHistory.batchTrackHistory(unifiedResults);
    
    logger.info(`[CacheManager] Persisted ${unifiedResults.length} items to cache and history for "${query}"`);
  }

  /**
   * Extracts historical pricing data to draw frontend trend graphs.
   * @param {string} normalizedTitle 
   */
  static async getPriceHistory(normalizedTitle) {
    return await productHistory.getProductHistory(normalizedTitle);
  }

  /**
   * Forces a cache miss on the next request.
   * @param {string} query 
   */
  static async forceRefresh(query) {
    await searchCache.invalidateSearchCache(query);
  }

  // ── In-Memory Cache Methods (Replacing legacy cacheService) ──

  static get(key) {
    const value = memoryCache.get(key);
    if (value !== undefined) {
      logger.debug(`[CacheManager] Memory HIT: ${key}`);
      return value;
    }
    logger.debug(`[CacheManager] Memory MISS: ${key}`);
    return null;
  }

  static set(key, value, ttl) {
    if (ttl !== undefined) {
      memoryCache.set(key, value, ttl);
    } else {
      memoryCache.set(key, value);
    }
  }

  static del(key) {
    memoryCache.del(key);
  }

  static productKey(id) {
    return `product:${id}`;
  }
}

module.exports = CacheManager;
