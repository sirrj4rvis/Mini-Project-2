/**
 * Normalizes raw titles into a comparable format for Croma products.
 * Lowercases and removes extra whitespace to allow cross-platform matching.
 */
function normalizeCromaTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parses Indian currency strings into floats.
 * e.g., "₹45,990.00" -> 45990
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  // Remove all characters except digits and decimal point
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Extracts floating point rating.
 * e.g., "4.3" or "Rating: 4.3" -> 4.3
 */
function parseRating(ratingStr) {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extracts integer review/rating counts.
 * e.g., "(128 Reviews)" -> 128
 */
function parseReviewCount(reviewStr) {
  if (!reviewStr) return 0;
  const cleaned = reviewStr.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Heuristics-based categorization based on electronics keywords.
 * Essential for grouping Croma's tech inventory correctly.
 */
function determineCategory(title) {
  const t = title.toLowerCase();
  
  if (t.includes('laptop') || t.includes('macbook') || t.includes('notebook')) return 'Laptops';
  if (t.includes('monitor') || t.includes('display')) return 'Monitors';
  if (t.includes('keyboard') || t.includes('mouse') || t.includes('controller') || t.includes('gamepad')) return 'Gaming Peripherals';
  if (t.includes('charger') || t.includes('adapter') || t.includes('cable') || t.includes('power bank')) return 'Chargers';
  if (t.includes('earphone') || t.includes('headphone') || t.includes('earbud') || t.includes('speaker') || t.includes('soundbar')) return 'Audio';
  if (t.includes('phone') || t.includes('smartphone') || t.includes('iphone')) return 'Smartphones';
  if (t.includes('tv') || t.includes('television')) return 'Televisions';
  if (t.includes('watch') || t.includes('smartwatch') || t.includes('band')) return 'Wearables';
  if (t.includes('tablet') || t.includes('ipad')) return 'Tablets';
  
  return 'Electronics'; // Fallback for appliances, etc.
}

module.exports = {
  normalizeCromaTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
};
