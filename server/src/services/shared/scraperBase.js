const { createScraperClient } = require('./axiosClient');
const logger = require('./logger');
const DelayManager = require('../antiblock/delayManager');
const RateLimiter = require('../antiblock/rateLimiter');

/**
 * Base abstract class for all product scrapers.
 * Enforces a standardized architecture across different e-commerce sources.
 */
class ScraperBase {
  /**
   * @param {Object} options 
   * @param {string} options.sourceName - e.g., 'Amazon', 'Flipkart'
   * @param {number} options.timeout - Request timeout
   */
  constructor(options = {}) {
    this.sourceName = options.sourceName || 'UnknownSource';
    this.client = createScraperClient({ timeout: options.timeout });
    
    // Scoped logger for this specific source
    this.logger = {
      info: (msg) => logger.info(msg, { source: this.sourceName }),
      warn: (msg) => logger.warn(msg, { source: this.sourceName }),
      error: (msg) => logger.error(msg, { source: this.sourceName }),
      debug: (msg) => logger.debug(msg, { source: this.sourceName }),
    };
  }

  /**
   * [ABSTRACT] Construct the search URL for the source.
   * @param {string} query 
   * @returns {string} url
   */
  buildSearchUrl(query) {
    throw new Error('buildSearchUrl() must be implemented by subclass');
  }

  /**
   * [ABSTRACT] Parse HTML/JSON and extract raw product data.
   * @param {any} responseData - HTML string or JSON
   * @returns {Array<Object>}
   */
  async extractData(responseData) {
    throw new Error('extractData() must be implemented by subclass');
  }

  /**
   * [ABSTRACT] Convert raw scraped data into the Unified Product Schema.
   * @param {Object} rawProduct 
   * @returns {Object} normalizedProduct
   */
  normalizeProduct(rawProduct) {
    throw new Error('normalizeProduct() must be implemented by subclass');
  }

  /**
   * Core orchestrator method for scraping products by query.
   * Handles delays, HTTP requests, error catching, and normalization.
   * 
   * @param {string} query 
   * @returns {Promise<Array<Object>>}
   */
  async search(query) {
    this.logger.info(`Starting search for: "${query}"`);
    try {
      const url = this.buildSearchUrl(query);
      
      // Advanced Anti-Block: Global rate limit per domain + humanized jitter
      const domain = new URL(url).hostname;
      await RateLimiter.throttle(domain, 2000);
      await DelayManager.randomSleep(800, 2000);

      const response = await this.client.get(url);
      
      const rawData = await this.extractData(response.data);
      if (!rawData || rawData.length === 0) {
        this.logger.warn(`No results found for: "${query}"`);
        return [];
      }

      // Map raw data through the specific source normalizer
      const normalizedProducts = rawData.map(item => {
        try {
          return this.normalizeProduct(item);
        } catch (err) {
          this.logger.warn(`Failed to normalize an item: ${err.message}`);
          return null;
        }
      }).filter(Boolean); // Remove failed items

      this.logger.info(`Successfully extracted ${normalizedProducts.length} products for: "${query}"`);
      return normalizedProducts;

    } catch (error) {
      this.logger.error(`Search failed for "${query}": ${error.message}`);
      return []; // Graceful degradation - don't crash the aggregation pipeline
    }
  }
}

module.exports = ScraperBase;
