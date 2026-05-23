const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');

const DEV_CACHE_PATH = path.join(__dirname, '../../../../.cache.json');

// Bug 3 fix: Serialize all disk writes to prevent race-condition file corruption.
// Concurrent requests calling readFileSync+writeFileSync simultaneously will corrupt JSON.
// This write lock ensures only one write executes at a time; reads remain unlocked
// (a stale read just causes a DB fallback — acceptable).
let _writePromise = Promise.resolve();

// ── Mongoose Schema Definition ───────────────────────────────────────────────
// We define it inline to ensure the service is perfectly self-contained.
// MongoDB TTL indexes automatically delete documents after a specified time.
const SearchCacheSchema = new mongoose.Schema({
  query: { type: String, required: true, unique: true, lowercase: true, index: true },
  results: { type: [mongoose.Schema.Types.Mixed], required: true, default: [] },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    // Uses CACHE_TTL_SEARCH from .env, defaults to 5 minutes (300s)
    expires: parseInt(process.env.CACHE_TTL_SEARCH || 300, 10) 
  }
});

const SearchCache = mongoose.models.SearchCache || mongoose.model('SearchCache', SearchCacheSchema);

/**
 * Retrieves valid cached results for a given query.
 * @param {string} query 
 * @returns {Array|null}
 */
async function getCachedSearch(query) {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Check persistent Dev Disk Cache to save API quota
  if (process.env.NODE_ENV === 'development') {
    try {
      if (fs.existsSync(DEV_CACHE_PATH)) {
        const fileCache = JSON.parse(fs.readFileSync(DEV_CACHE_PATH, 'utf8'));
        if (fileCache[normalizedQuery]) {
          logger.info(`[SearchCache] Disk Cache HIT for query: "${query}"`);
          return fileCache[normalizedQuery].results;
        }
      }
    } catch (e) {
      logger.warn(`[SearchCache] Failed to read disk cache: ${e.message}`);
    }
  }

  // 2. Check MongoDB Cache
  try {
    const cached = await SearchCache.findOne({ query: normalizedQuery });
    if (cached) {
      logger.info(`[SearchCache] DB Cache HIT for query: "${query}"`);
      return cached.results;
    }
    logger.info(`[SearchCache] Cache MISS for query: "${query}"`);
    return null;
  } catch (error) {
    logger.error(`[SearchCache] Error reading cache for "${query}": ${error.message}`);
    return null; // Graceful degradation: If DB fails, proceed to live scraping
  }
}

/**
 * Saves aggregation results to the DB with an automatic expiration.
 * @param {string} query 
 * @param {Array} results 
 */
async function cacheSearchResults(query, results) {
  const normalizedQuery = query.toLowerCase().trim();

  try {
    // Only cache substantial results to prevent poisoning the cache with failed runs
    if (!results || results.length === 0) return; 

    // 1. Write to Dev Disk Cache (serialized to prevent race conditions — Bug 3 fix)
    if (process.env.NODE_ENV === 'development') {
      _writePromise = _writePromise.then(() => {
        try {
          let fileCache = {};
          if (fs.existsSync(DEV_CACHE_PATH)) {
            fileCache = JSON.parse(fs.readFileSync(DEV_CACHE_PATH, 'utf8'));
          }
          fileCache[normalizedQuery] = { results, timestamp: new Date().toISOString() };
          fs.writeFileSync(DEV_CACHE_PATH, JSON.stringify(fileCache, null, 2));
        } catch (e) {
          logger.warn(`[SearchCache] Failed to write disk cache: ${e.message}`);
        }
      });
      await _writePromise;
    }
    
    // 2. Write to MongoDB
    await SearchCache.findOneAndUpdate(
      { query: normalizedQuery },
      { results, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    logger.debug(`[SearchCache] Saved ${results.length} results for query: "${query}"`);
  } catch (error) {
    logger.error(`[SearchCache] Error saving cache for "${query}": ${error.message}`);
  }
}

/**
 * Manually deletes a cached query, forcing a live re-scrape on the next request.
 * Useful for admin panels or "Refresh Data" buttons.
 */
async function invalidateSearchCache(query) {
  try {
    await SearchCache.deleteOne({ query: query.toLowerCase().trim() });
    logger.info(`[SearchCache] Invalidated cache for query: "${query}"`);
  } catch (error) {
    logger.error(`[SearchCache] Error invalidating cache: ${error.message}`);
  }
}

module.exports = { getCachedSearch, cacheSearchResults, invalidateSearchCache };
