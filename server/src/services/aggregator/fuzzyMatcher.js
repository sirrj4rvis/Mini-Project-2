const { extractKeyTokens } = require('./titleNormalizer');

/**
 * Calculates Jaccard similarity index between two arrays of tokens.
 * Highly effective for ecommerce titles where word order doesn't matter
 * (e.g., "Logitech G102 Gaming Mouse" vs "Logitech Mouse G102").
 * Returns a score between 0.0 and 1.0.
 */
function jaccardSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

/**
 * Core matching algorithm.
 * Determines if two normalized products represent the exact same product using pre-computed tokens.
 */
function isFuzzyMatch(tokensA, tokensB, threshold = 0.65) {
  if (!tokensA || !tokensB) return false;

  const { baseTokens: baseA, highSignalTokens: highA } = tokensA;
  const { baseTokens: baseB, highSignalTokens: highB } = tokensB;

  // ── Strict Model Conflict Resolution ──
  // If both titles explicitly contain high-signal model numbers (e.g., G102 vs G502),
  // they MUST intersect. Even if 90% of the other words match, a different model is a different product.
  if (highA.length > 0 && highB.length > 0) {
    const hasSharedModel = highA.some(token => highB.includes(token));
    if (!hasSharedModel) return false; 
  }

  // Fallback to Jaccard similarity for the remaining tokens
  const score = jaccardSimilarity(baseA, baseB);
  return score >= threshold;
}

module.exports = { isFuzzyMatch, jaccardSimilarity };
