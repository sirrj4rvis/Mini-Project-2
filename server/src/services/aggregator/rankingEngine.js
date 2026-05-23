const { calculateScore } = require('./scoreCalculator');
const logger = require('../shared/logger');

/**
 * Production-Grade Product Ranking Engine.
 * Evaluates an array of deduplicated products, assigns a unified quality "Deal Score",
 * and sorts them to ensure the absolute best products surface first.
 * 
 * @param {Array} products - Array of unified/deduplicated products
 * @param {string} query - The original search query
 * @returns {Array} - Ranked array of products
 */
function rankProducts(products, query) {
  if (!products || products.length === 0) return [];

  const startTime = Date.now();

  // ── 1. Calculate Market Bounds (Dynamic Price Curve) ──
  // We need to know the min and max price of the market to score individual items.
  const validPrices = products.map(p => p.price).filter(p => p > 0).sort((a, b) => a - b);
  
  // Use the 5th and 95th percentiles to determine the range.
  // This prevents fake $1 listings or bundled $5000 listings from skewing the math.
  const minPriceIdx = Math.floor(validPrices.length * 0.05);
  const maxPriceIdx = Math.floor(validPrices.length * 0.95);
  
  const minPrice = validPrices[minPriceIdx] || validPrices[0] || 1;
  const maxPrice = validPrices[maxPriceIdx] || validPrices[validPrices.length - 1] || minPrice * 2;

  // ── 2. Scoring ──
  const scoredProducts = products.map(product => {
    const baseScore = calculateScore(product, query, minPrice, maxPrice);
    
    // Modifier: Exact Match Boost
    // If the title literally starts with the query, it's highly likely to be the exact item.
    const exactMatchBoost = product.title.toLowerCase().startsWith(query.toLowerCase()) ? 5 : 0;
    
    // Modifier: Availability Penalty
    const availabilityPenalty = product.availability && product.availability.toLowerCase().includes('out') ? 30 : 0;

    return {
      ...product,
      _rankingScore: Math.max(0, Math.min(baseScore + exactMatchBoost - availabilityPenalty, 100))
    };
  });

  // ── 3. Sorting ──
  // Descending order: Highest score surfaces first
  scoredProducts.sort((a, b) => b._rankingScore - a._rankingScore);

  // ── 4. Cleanup and Format ──
  const rankedResults = scoredProducts.map(p => {
    // Expose the score as 'dealScore' for the frontend UI (e.g. to display a 9.5/10 badge)
    const finalProduct = { ...p, dealScore: parseFloat(p._rankingScore.toFixed(1)) };
    
    // Strip internal private variables
    delete finalProduct._rankingScore;
    return finalProduct;
  });

  const duration = Date.now() - startTime;
  logger.debug(`[RankingEngine] Ranked ${rankedResults.length} products in ${duration}ms`);

  return rankedResults;
}

module.exports = { rankProducts };
