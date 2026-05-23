const ProductPopularityAnalyzer = require('./productPopularityAnalyzer');

/**
 * Advanced multi-dimensional scoring system.
 * Evaluates a product against global market statistics to find exceptional deals.
 */
class SmartRecommendationScorer {
  /**
   * Calculates individual aspect scores for a product relative to its market cohort.
   * 
   * @param {Object} product 
   * @param {Object} marketStats - Pre-calculated percentiles for the search result pool
   * @returns {Object} Multidimensional score profile
   */
  static calculateScores(product, marketStats) {
    const price = product.price || product.bestPrice || 0;
    if (price <= 0) return { valueScore: 0, premiumScore: 0, budgetScore: 0, popularityScore: 0 };

    const popularityScore = ProductPopularityAnalyzer.getPopularityScore(product);
    
    // ── 1. Value Score ──
    // High rating, high popularity, and price below the market median.
    let valueScore = popularityScore * (marketStats.medianPrice / price);
    
    // ── 2. Budget Score ──
    // Strictly lowest tier price (Bottom 25%) but must maintain a minimum quality floor (3.8+ stars)
    let budgetScore = 0;
    if (price <= marketStats.p25Price && (product.rating || 0) >= 3.8) {
      budgetScore = (marketStats.p25Price / price) * 100 + popularityScore;
    }

    // ── 3. Premium Score ──
    // Top-tier price (Top 25% flagship items) with extremely high trust/popularity
    let premiumScore = 0;
    if (price >= marketStats.p75Price) {
      premiumScore = popularityScore * (product.rating || 0) * 1.5;
    }

    return {
      valueScore: parseFloat(valueScore.toFixed(2)),
      budgetScore: parseFloat(budgetScore.toFixed(2)),
      premiumScore: parseFloat(premiumScore.toFixed(2)),
      popularityScore
    };
  }
}

module.exports = SmartRecommendationScorer;
