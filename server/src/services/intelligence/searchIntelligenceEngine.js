const QueryUnderstanding = require('./queryUnderstanding');
const SemanticSearchScorer = require('./semanticSearchScorer');
// Bug 16 fix: Corrected fragile self-referential path '../../services/shared/logger'
// to the correct single-level relative path from this file's location.
const logger = require('../shared/logger');

/**
 * Top-Level Search Intelligence Engine.
 * Injects natural language processing logic into the Aggregation Pipeline,
 * fundamentally transforming raw keyword matching into semantic intent matching.
 */
class SearchIntelligenceEngine {
  
  /**
   * Phase 1: Enriches a raw query into a smart query context object.
   * Modifies the text *before* it hits the scrapers to ensure higher quality API responses.
   * 
   * @param {string} rawQuery 
   * @returns {Object} queryContext
   */
  static parseQuery(rawQuery) {
    const context = QueryUnderstanding.analyze(rawQuery);
    logger.info(`[Intelligence] Parsed "${rawQuery}" -> Executing: "${context.cleanSearchQuery}" | Category: ${context.intent.primaryCategory}`);
    return context;
  }

  /**
   * Phase 2: Applies semantic scoring and intent-based re-ranking to the final unified products.
   * Runs *after* the Aggregator's standard ranking engine to forcefully inject human-like relevance.
   * 
   * @param {Array} products - Scraped & structurally ranked products
   * @param {Object} queryContext - Parsed intelligence context
   * @returns {Array} - Semantically re-ranked products
   */
  static applyIntelligence(products, queryContext) {
    if (!products || products.length === 0) return [];

    const { intent } = queryContext;

    // Apply semantic multipliers mathematically to the existing Deal Scores
    const intelligentlyScored = products.map(product => {
      
      // Fallback in case ranking engine hasn't run
      let currentScore = product.dealScore || 50; 
      
      // Get intent multiplier (e.g. Penalize accessories if looking for laptops)
      const semanticMultiplier = SemanticSearchScorer.scoreRelevance(product, queryContext);
      
      let newScore = currentScore * semanticMultiplier;

      // ── 3. Apply Price Intent Directives ──
      if (intent.isCheap) {
        // Boost cheaper items aggressively
        if (product.price > 0 && product.price < 3000) newScore *= 1.2;
      }
      
      if (intent.isPremium) {
        // Boost flagship items
        if (product.price > 40000) newScore *= 1.2;
      }

      return {
        ...product,
        dealScore: Math.max(0, Math.min(parseFloat(newScore.toFixed(1)), 100))
      };
    });

    // Final Sort: Descending based on the new intelligent score
    intelligentlyScored.sort((a, b) => b.dealScore - a.dealScore);

    return intelligentlyScored;
  }
}

module.exports = SearchIntelligenceEngine;
