/**
 * Typo Correction and Synonym Mapping Engine.
 * Automatically fixes common spelling mistakes and expands colloquial terms 
 * into highly searchable keywords without requiring heavy ML NLP models.
 */

const SYNONYMS = {
  'mobiles': 'smartphone',
  'mobile': 'smartphone',
  'cellphone': 'smartphone',
  'lappy': 'laptop',
  'mac': 'macbook',
  'earphones': 'headphones',
  'earbuds': 'headphones',
  'tws': 'earbuds',
  'tv': 'television',
  'sneakers': 'shoes',
  'kicks': 'shoes',
  'tshirt': 'shirt',
  't-shirt': 'shirt',
  'hdd': 'hard drive',
  'ssd': 'solid state drive'
};

const COMMON_TYPOS = {
  'iphon': 'iphone',
  'ipone': 'iphone',
  'samasung': 'samsung',
  'samung': 'samsung',
  'headfones': 'headphones',
  'lapto': 'laptop',
  'mause': 'mouse',
  'mous': 'mouse',
  'moniter': 'monitor',
  'blutooth': 'bluetooth',
  'wireles': 'wireless'
};

class TypoCorrectionEngine {
  /**
   * Scans a search query, corrects typos, and standardizes synonyms.
   * @param {string} query 
   * @returns {string} The normalized, highly-searchable query string
   */
  static process(query) {
    if (!query) return '';
    
    // Split query into discrete tokens
    let tokens = query.toLowerCase().trim().split(/\s+/);
    
    tokens = tokens.map(token => {
      // 1. Fix known common typos
      if (COMMON_TYPOS[token]) {
        return COMMON_TYPOS[token];
      }
      // 2. Expand slang/synonyms into official ecommerce taxonomy
      if (SYNONYMS[token]) {
        return SYNONYMS[token];
      }
      return token;
    });

    return tokens.join(' ');
  }
}

module.exports = TypoCorrectionEngine;
