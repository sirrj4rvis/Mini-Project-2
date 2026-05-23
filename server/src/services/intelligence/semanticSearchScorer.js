/**
 * Semantic Relevance Scorer.
 * Evaluates products against the structured user intent context rather than relying 
 * solely on exact text matches.
 */

class SemanticSearchScorer {
  /**
   * Calculates a semantic relevance multiplier based on user intent.
   * 
   * @param {Object} product - The unified product payload
   * @param {Object} queryContext - The output of QueryUnderstanding.analyze()
   * @returns {number} Multiplier (1.0 = neutral, >1 = boost, <1 = heavy penalty)
   */
  static scoreRelevance(product, queryContext) {
    let multiplier = 1.0;
    const pTitle = product.title.toLowerCase();
    const { intent } = queryContext;

    // ── 1. Brand Affinity Integrity ──
    if (intent.brandFocus) {
      if (pTitle.includes(intent.brandFocus) || (product.brand && product.brand.toLowerCase() === intent.brandFocus)) {
        multiplier *= 1.3; // 30% boost for matching the highly specific requested brand
      } else {
        multiplier *= 0.4; // 60% penalty for different brands (e.g. searching "apple phone" but API returning "samsung")
      }
    }

    // ── 2. The Accessory Problem (Noise Reduction) ──
    // Core ecommerce issue: Searching "iphone" returns iPhone cases instead of iPhones because they are cheaper and bestsellers.
    if (!intent.isAccessories) {
      if (/case|cover|cable|charger|protector|strap|band/.test(pTitle)) {
        multiplier *= 0.2; // 80% penalty to clear up the UI and banish accessories to the bottom
      }
    } else {
      // If they explicitly searched for an accessory, boost it
      if (/case|cover|cable|charger|protector|strap|band/.test(pTitle)) {
        multiplier *= 1.4;
      }
    }

    // ── 3. Gaming Intent Match ──
    if (intent.isGaming) {
      if (/gaming|rgb|gamer|fps|hz/.test(pTitle)) {
        multiplier *= 1.25;
      }
    }

    return multiplier;
  }
}

module.exports = SemanticSearchScorer;
