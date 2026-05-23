/**
 * Normalizes and standardizes product titles by removing noisy stop-words, 
 * promotional text, and platform-specific junk.
 */

const PROMO_WORDS = [
  'new', 'latest', 'original', 'genuine', 'authentic', '100%', 
  'sale', 'discount', 'offer', 'deal', 'cheap', 'best price',
  'free shipping', 'warranty', 'refurbished', 'renewed', 'open box'
];

class TitleStandardizer {
  /**
   * Cleans raw title text for consistent analytical comparison.
   * @param {string} rawTitle 
   * @returns {string} Cleaned lowercased title
   */
  static standardize(rawTitle) {
    if (!rawTitle) return '';
    
    let clean = rawTitle.toLowerCase();
    
    // 1. Remove special characters and excessive whitespace (keep dashes, slashes)
    clean = clean.replace(/[^\w\s\-\.\/]/gi, ' ');
    
    // 2. Remove promotional ecommerce buzzwords that break deduplication
    PROMO_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      clean = clean.replace(regex, '');
    });
    
    // 3. Remove standalone dashes or slashes left behind
    clean = clean.replace(/\s[\-\/]\s/g, ' ');
    
    // 4. Collapse spacing
    clean = clean.replace(/\s+/g, ' ').trim();
    
    return clean;
  }
}

module.exports = TitleStandardizer;
