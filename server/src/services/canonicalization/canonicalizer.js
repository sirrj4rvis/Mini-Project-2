const ProductIdentityEngine = require('./productIdentityEngine');
const logger = require('../../services/shared/logger');

/**
 * Top-Level Canonicalization Engine.
 * Iterates over an array of products, enriching them with standardized canonical 
 * identities and clean titles. This prepares them for highly accurate Deduplication.
 */
class Canonicalizer {
  
  /**
   * Enriches raw scraped products with strict canonical signatures.
   * 
   * @param {Array} products - The array of raw products from scrapers
   * @returns {Array} Canonicalized products ready for deduplication
   */
  static process(products) {
    if (!products || !Array.isArray(products)) return [];

    logger.debug(`[Canonicalizer] Standardizing identities for ${products.length} products...`);

    const enriched = products.map(product => {
      // 1. Generate core identity components
      const identity = ProductIdentityEngine.generateIdentity(product);

      // 2. Build a Clean Canonical Title (e.g., "Logitech G102 8GB Black")
      const titleParts = [];
      if (identity.brand && identity.brand !== 'Unknown') titleParts.push(identity.brand);
      if (identity.model) titleParts.push(identity.model);
      
      let canonicalTitle = titleParts.join(' ');
      
      // Fallback: If we couldn't extract a clear brand/model, use the first 4 words of the clean title
      if (titleParts.length === 0) {
        canonicalTitle = identity.standardizedTitle.split(' ').slice(0, 4).join(' ');
      }

      // Append critical hardware/fashion specifications
      if (identity.specs.storage) canonicalTitle += ` ${identity.specs.storage}`;
      if (identity.specs.ram) canonicalTitle += ` ${identity.specs.ram} RAM`;
      if (identity.specs.color) canonicalTitle += ` (${identity.specs.color})`;

      // Ensure proper capitalization (Title Case)
      canonicalTitle = canonicalTitle
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .replace(/\( /g, '(')
        .replace(/ \)/g, ')'); // Fix bracket spacing

      return {
        ...product,
        // Inject the newly generated canonical metadata
        canonicalTitle: canonicalTitle.trim(),
        canonicalSignature: identity.signature,
        brand: identity.brand,
        specs: identity.specs
      };
    });

    return enriched;
  }
}

module.exports = Canonicalizer;
