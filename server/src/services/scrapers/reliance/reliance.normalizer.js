/**
 * Normalizes raw titles into a comparable format for Reliance Digital products.
 * Lowercases and removes extra whitespace to enable cross-platform aggregation matching.
 */
function normalizeRelianceTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parses Indian currency strings into floats.
 * e.g., "₹ 1,14,900.00" -> 114900
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  // Remove all characters except digits and decimal point
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Extracts floating point rating.
 * e.g., "4.6" -> 4.6
 */
function parseRating(ratingStr) {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extracts integer review/rating counts.
 * e.g., "(45)" -> 45
 */
function parseReviewCount(reviewStr) {
  if (!reviewStr) return 0;
  const cleaned = reviewStr.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Heuristics-based categorization based on Reliance Digital's product range.
 * Essential for grouping inventory efficiently for the end-user.
 */
function determineCategory(title) {
  const t = title.toLowerCase();
  
  if (t.includes('laptop') || t.includes('macbook') || t.includes('notebook')) return 'Laptops';
  if (t.includes('monitor') || t.includes('display')) return 'Monitors';
  if (t.includes('phone') || t.includes('smartphone') || t.includes('iphone')) return 'Mobile Phones';
  if (t.includes('playstation') || t.includes('xbox') || t.includes('nintendo') || t.includes('gaming') || t.includes('console')) return 'Gaming';
  if (t.includes('mouse') || t.includes('keyboard') || t.includes('controller') || t.includes('webcam')) return 'Accessories';
  if (t.includes('charger') || t.includes('cable') || t.includes('adapter') || t.includes('powerbank')) return 'Accessories';
  if (t.includes('earphone') || t.includes('headphone') || t.includes('speaker') || t.includes('soundbar')) return 'Audio';
  if (t.includes('tv') || t.includes('television')) return 'Televisions';
  
  return 'Electronics'; // General fallback
}

module.exports = {
  normalizeRelianceTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
};
