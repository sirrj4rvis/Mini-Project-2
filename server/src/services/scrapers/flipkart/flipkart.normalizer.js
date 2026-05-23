/**
 * Normalizes raw titles into a comparable format.
 * Lowercases and removes extra whitespace.
 */
function normalizeFlipkartTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parses Indian currency strings into floats.
 * e.g., "₹1,25,000" -> 125000
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  // Remove all characters except digits and decimal point
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Extracts floating point rating.
 * e.g., "4.5" -> 4.5
 */
function parseRating(ratingStr) {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extracts integer review counts.
 * e.g., "1,234 Ratings & 56 Reviews" -> 1234
 */
function parseReviewCount(reviewStr) {
  if (!reviewStr) return 0;
  // Flipkart usually formats it as "X,XXX Ratings & Y,YYY Reviews"
  // We grab the first number which represents Ratings/Reviews
  const cleaned = reviewStr.split('&')[0].replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Heuristics-based categorization based on title keywords.
 * Enables category-independent scraping while maintaining structured data.
 */
function determineCategory(title) {
  const t = title.toLowerCase();
  
  if (t.includes('laptop') || t.includes('macbook')) return 'Laptops';
  if (t.includes('monitor') || t.includes('display')) return 'Monitors';
  if (t.includes('mouse') || t.includes('mice')) return 'Accessories';
  if (t.includes('keyboard')) return 'Accessories';
  if (t.includes('headphone') || t.includes('earbud') || t.includes('headset') || t.includes('earphone')) return 'Audio';
  if (t.includes('charger') || t.includes('adapter') || t.includes('cable')) return 'Accessories';
  if (t.includes('phone') || t.includes('smartphone') || t.includes('iphone')) return 'Smartphones';
  if (t.includes('tablet') || t.includes('ipad')) return 'Tablets';
  if (t.includes('watch') || t.includes('smartwatch')) return 'Wearables';
  
  return 'Electronics'; // Fallback category
}

module.exports = {
  normalizeFlipkartTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
};
