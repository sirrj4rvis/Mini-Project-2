/**
 * Standardized set of test queries used to benchmark and validate 
 * the health of all scrapers and APIs.
 * 
 * Mixes various categories (electronics, fashion, generic) to ensure
 * category-specific scraping logic triggers correctly.
 */
const testQueries = [
  'mouse',
  'monitor',
  'keyboard',
  'charger',
  'shirt',
  'jeans',
  'headphones',
  'iphone'
];

module.exports = { testQueries };
