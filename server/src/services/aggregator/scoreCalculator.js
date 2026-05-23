/**
 * Calculates a unified quality score (0.0 to 100.0) for an e-commerce product 
 * based on multiple weighted signals including price, ratings, and source trust.
 */

// Source trust weights: Established platforms with reliable return policies score higher.
const SOURCE_TRUST_WEIGHTS = {
  'Amazon': 1.0,
  'Flipkart': 0.95,
  'Myntra': 0.9,
  'Croma': 0.85,
  'Reliance Digital': 0.85,
  'Walmart': 0.85,  // Bug 17 fix: Walmart was missing — defaulting to 0.7 which unfairly penalised it
  'eBay': 0.8       // eBay varies widely due to individual sellers
};

/**
 * Main scoring algorithm.
 * @param {Object} product - The unified product object
 * @param {string} query - The search query for relevance checking
 * @param {number} minPrice - P5 (5th percentile) market price
 * @param {number} maxPrice - P95 (95th percentile) market price
 */
function calculateScore(product, query, minPrice, maxPrice) {
  let score = 0;

  // ── 1. Price Score (Max 40 points) ──
  // Cheaper is better. We use an inverse proportion based on the market range.
  const priceRange = maxPrice - minPrice || 1;
  const pricePosition = (product.price - minPrice) / priceRange; 
  // Clamp between 0 and 1 so outliers don't break the math
  const clampedPosition = Math.max(0, Math.min(pricePosition, 1));
  let priceScore = (1 - clampedPosition) * 40; 
  if (product.price <= 0) priceScore = 0; // Penalty for broken data
  score += priceScore;

  // ── 2. Ratings Score (Max 20 points) ──
  // Linear scale: 5.0 rating = 20 pts, 4.0 = 16 pts.
  const ratingScore = (product.rating / 5) * 20;
  score += ratingScore || 0;

  // ── 3. Popularity / Review Count Score (Max 15 points) ──
  // Logarithmic scale because the difference between 1k and 10k reviews 
  // is less impactful than 10 vs 100 reviews.
  let reviewScore = 0;
  if (product.reviewCount > 0) {
    const logReview = Math.log10(product.reviewCount + 1); // 10->1, 100->2, 1000->3, 10000->4
    reviewScore = Math.min((logReview / 4) * 15, 15); 
  }
  score += reviewScore;

  // ── 4. Source Quality / Trust (Max 10 points) ──
  // Evaluates how trustworthy the merchant is. 
  const baseTrust = SOURCE_TRUST_WEIGHTS[product.source] || 0.7;
  let sourceScore = baseTrust * 10;
  
  // If the product was deduplicated across multiple stores, it's highly verified.
  if (product.storeCount && product.storeCount > 1) {
    sourceScore = Math.min(sourceScore + (product.storeCount * 2), 10);
  }
  score += sourceScore;

  // ── 5. Relevance (Max 15 points) ──
  // Jaccard-style token overlap between the search query and the product title.
  const relevanceScore = calculateRelevance(query, product.title) * 15;
  score += relevanceScore;

  // Clamp final score safely between 0 and 100
  return Math.max(0, Math.min(score, 100)); 
}

/**
 * Calculates how relevant the product title is to the original search query.
 */
function calculateRelevance(query, title) {
  if (!query || !title) return 0.5; // Neutral fallback
  
  const qTokens = new Set(query.toLowerCase().trim().split(/\s+/));
  const tTokens = new Set(title.toLowerCase().trim().split(/\s+/));
  
  const intersection = new Set([...qTokens].filter(x => tTokens.has(x)));
  
  // We divide by query size, not union size. 
  // If query is "iphone 13", and title is "Apple iPhone 13 128GB Blue",
  // it contains 100% of the query tokens, meaning it is highly relevant.
  return intersection.size / qTokens.size; 
}

module.exports = { calculateScore };
