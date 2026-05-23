const { normalizeForMatching, extractKeyTokens } = require('./titleNormalizer');
const { isFuzzyMatch } = require('./fuzzyMatcher');

/**
 * Merges an array of duplicate products into a single "super-product".
 * Resolves pricing conflicts, aggregates links, and extracts the best metrics.
 * 
 * @param {Array} duplicateGroup - Array of product objects deemed identical
 * @returns {Object} - A single unified product
 */
function mergeDuplicates(duplicateGroup) {
  if (!duplicateGroup || duplicateGroup.length === 0) return null;
  
  // Fast path for solitary products
  if (duplicateGroup.length === 1) {
    const p = duplicateGroup[0];
    p.storeCount = 1;
    p.sources = [{
      name: p.source,
      platform: normalizePlatform(p.source),
      price: p.price,
      link: p.link,
      availability: p.availability
    }];
    return p;
  }

  // Sort group by price ascending to easily grab the best deal
  const sorted = [...duplicateGroup].sort((a, b) => a.price - b.price);
  const bestPriced = sorted[0]; // The canonical base object

  // Aggregate all source data so the user can choose where to buy
  const sources = sorted.map(p => ({
    name: p.source,
    platform: normalizePlatform(p.source),
    price: p.price,
    link: p.link,
    availability: p.availability
  }));

  // Extract the highest rating and review counts across all platforms
  const bestRating = sorted.reduce((max, p) => (p.rating > max ? p.rating : max), 0);
  const maxReviews = sorted.reduce((max, p) => (p.reviewCount > max ? p.reviewCount : max), 0);

  // Return unified super-product
  return {
    ...bestPriced,
    rating: bestRating, // Preserved best
    reviewCount: maxReviews, // Preserved best
    storeCount: sources.length,
    sources: sources // Detailed multi-store array
  };
}

function normalizePlatform(sourceName = '') {
  const platform = String(sourceName).toLowerCase();
  if (platform.includes('amazon')) return 'amazon';
  if (platform.includes('flipkart')) return 'flipkart';
  if (platform.includes('ebay')) return 'ebay';
  if (platform.includes('walmart')) return 'walmart';
  return 'other';
}

/**
 * Main Deduplication Engine Pipeline.
 * Takes a flat array of multi-source products, clusters them via fuzzy matching,
 * and merges them down to unique listings.
 * 
 * @param {Array} rawProducts - Flat, normalized list from parallelSearch
 * @param {number} threshold - Fuzzy match strictness (0.0 to 1.0)
 * @returns {Array} - Cleaned, aggregated, and ranked list
 */
function deduplicateProducts(rawProducts, threshold = 0.65) {
  const groups = [];

  // Pre-process titles and extract tokens once for performance O(N)
  const processedProducts = rawProducts.map(p => {
    const matchTitle = normalizeForMatching(p.title);
    return {
      ...p,
      _matchTitle: matchTitle,
      _matchTokens: extractKeyTokens(matchTitle)
    };
  });

  // O(N^2) clustering algorithm - groups identical items
  processedProducts.forEach(product => {
    let foundGroup = false;

    for (const group of groups) {
      // Compare against the first item in the group as the canonical representative
      const canonical = group[0];
      
      // Fast-path: Exact match
      if (product._matchTitle === canonical._matchTitle) {
        group.push(product);
        foundGroup = true;
        break;
      }
      
      // Fallback: Fuzzy token match
      if (isFuzzyMatch(product._matchTokens, canonical._matchTokens, threshold)) {
        group.push(product);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.push([product]); // Start a new isolated cluster
    }
  });

  // Merge clusters and clean internal metadata
  // Bug 9 fix: mergeDuplicates can return null for empty groups — guard before delete
  const unifiedResults = groups.map(group => {
    const merged = mergeDuplicates(group);
    if (!merged) return null;
    delete merged._matchTokens;
    delete merged._matchTitle;
    return merged;
  }).filter(Boolean); // Strip any null results from empty/malformed groups

  // ── Ranking Engine ──
  // 1. Primary: Sort by cross-platform popularity (Store Count)
  // 2. Secondary: Sort by highest user rating
  return unifiedResults.sort((a, b) => {
    if (b.storeCount !== a.storeCount) {
      return b.storeCount - a.storeCount;
    }
    return b.rating - a.rating;
  });
}

module.exports = { deduplicateProducts };
