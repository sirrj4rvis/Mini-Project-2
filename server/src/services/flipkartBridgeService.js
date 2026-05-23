const axios = require('axios');
const logger = require('../config/logger');

const ML_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const flipkartClient = axios.create({
  baseURL: ML_BASE_URL,
  timeout: 45000, // Scraping can take longer, give it 45 seconds
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Request scraped products from Flipkart via the Python ML Service
 * @param {string} query - The search term
 * @param {number} pages - Number of pages to scrape (default 2)
 * @returns {Array} Array of raw scraped product data
 */
const searchFlipkartProducts = async (query, pages = 2) => {
  if (!query) return [];
  
  try {
    logger.info(`[Flipkart Scraper] Searching for "${query}" (pages: ${pages})`);
    
    const response = await flipkartClient.post('/scrape/flipkart', {
      query,
      pages
    });
    
    if (response.data && response.data.success) {
      const results = response.data.results || [];
      logger.info(`[Flipkart Scraper] Found ${results.length} results for "${query}"`);
      return results;
    }
    
    return [];
  } catch (err) {
    logger.error(`[Flipkart Scraper] Error searching for "${query}": ${err.message}`);
    return [];
  }
};

module.exports = { searchFlipkartProducts };
