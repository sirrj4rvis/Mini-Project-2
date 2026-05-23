const SmartRecommendationScorer = require('./smartRecommendationScorer');
const BuyingDecisionEngine = require('./buyingDecisionEngine');
const logger = require('../../services/shared/logger');

/**
 * Top-Level Recommendation Engine.
 * Analyzes a cohort of deduplicated products, calculates multidimensional market stats,
 * and assigns highly specific recommendation badges (Best Value, Budget Pick, etc.)
 */
class RecommendationEngine {
  
  /**
   * Processes an array of products to inject intelligent recommendations.
   * @param {Array} products 
   * @returns {Array} Enriched products
   */
  static process(products) {
    if (!products || products.length < 3) return products; // Require minimum dataset for comparison

    logger.debug(`[RecommendationEngine] Analyzing ${products.length} products to assign dynamic picks...`);

    // ── 1. Calculate Market Cohort Statistics ──
    const validPrices = products.map(p => p.price || p.bestPrice).filter(p => p > 0).sort((a, b) => a - b);
    const marketStats = {
      medianPrice: validPrices[Math.floor(validPrices.length / 2)],
      p25Price: validPrices[Math.floor(validPrices.length * 0.25)],
      p75Price: validPrices[Math.floor(validPrices.length * 0.75)],
      lowestPrice: validPrices[0]
    };

    // ── 2. Score all products & Evaluate Buying Window ──
    const scoredProducts = products.map(p => {
      const scores = SmartRecommendationScorer.calculateScores(p, marketStats);
      const buyingDecision = BuyingDecisionEngine.evaluate(p, p.history || []);
      
      return {
        ...p,
        _recScores: scores,
        recommendationAction: buyingDecision.action,
        recommendationReason: buyingDecision.reason,
        recommendationConfidence: buyingDecision.confidence
      };
    });

    // ── 3. Distribute Exclusive Recommendation Badges ──
    
    // Assign Best Value
    let bestValue = [...scoredProducts].sort((a, b) => b._recScores.valueScore - a._recScores.valueScore)[0];
    if (bestValue) bestValue.recommendationBadge = 'Best Value';

    // Assign Budget Pick (Must be strictly different from Best Value)
    let budgetPick = [...scoredProducts]
      .filter(p => p.id !== bestValue?.id)
      .sort((a, b) => b._recScores.budgetScore - a._recScores.budgetScore)[0];
    if (budgetPick && budgetPick._recScores.budgetScore > 0) {
      budgetPick.recommendationBadge = 'Budget Pick';
    }

    // Assign Premium Pick
    let premiumPick = [...scoredProducts]
      .filter(p => p.id !== bestValue?.id && p.id !== budgetPick?.id)
      .sort((a, b) => b._recScores.premiumScore - a._recScores.premiumScore)[0];
    if (premiumPick && premiumPick._recScores.premiumScore > 0) {
      premiumPick.recommendationBadge = 'Premium Pick';
    }

    // Assign Most Popular
    let mostPopular = [...scoredProducts]
      .filter(p => !p.recommendationBadge)
      .sort((a, b) => b._recScores.popularityScore - a._recScores.popularityScore)[0];
    if (mostPopular) {
      mostPopular.recommendationBadge = 'Most Popular';
    }

    // ── 4. Clean up and Return ──
    return scoredProducts.map(p => {
      delete p._recScores; // Remove temporary math
      return p;
    });
  }
}

module.exports = RecommendationEngine;
