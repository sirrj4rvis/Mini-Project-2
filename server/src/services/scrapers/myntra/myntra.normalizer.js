/**
 * Normalizes raw titles into a comparable format for Myntra products.
 * Combines brand and product name for a comprehensive title.
 */
function normalizeMyntraTitle(rawTitle, brand) {
  if (!rawTitle) return '';
  const fullTitle = brand ? `${brand} ${rawTitle}` : rawTitle;
  return fullTitle.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parses Indian currency strings into floats.
 * e.g., "Rs. 1499" or "1,499" -> 1499
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  // Remove all characters except digits and decimal point
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Extracts floating point rating.
 * e.g., "4.2 | 1.2k" -> 4.2
 */
function parseRating(ratingStr) {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extracts integer review/rating counts, resolving 'k' multipliers.
 * e.g., "1.2k" -> 1200, "500" -> 500
 */
function parseReviewCount(reviewStr) {
  if (!reviewStr) return 0;
  const cleaned = reviewStr.toLowerCase().replace(/[^0-9.k]/g, '');
  if (cleaned.includes('k')) {
    const num = parseFloat(cleaned.replace('k', ''));
    return isNaN(num) ? 0 : num * 1000;
  }
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Heuristics-based categorization based on fashion keywords.
 * Essential for aggregating Myntra results correctly.
 */
function determineCategory(title) {
  const t = title.toLowerCase();
  
  if (t.includes('shirt') || t.includes('tshirt') || t.includes('t-shirt') || t.includes('polo')) return 'Shirts';
  if (t.includes('jean') || t.includes('denim')) return 'Jeans';
  if (t.includes('shoe') || t.includes('sneaker') || t.includes('boot') || t.includes('sandal')) return 'Shoes';
  if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('pullover')) return 'Hoodies';
  if (t.includes('jacket') || t.includes('coat') || t.includes('blazer')) return 'Jackets';
  if (t.includes('watch') || t.includes('belt') || t.includes('wallet') || t.includes('cap')) return 'Accessories';
  if (t.includes('dress') || t.includes('gown')) return 'Dresses';
  
  return 'Fashion'; // Fallback generic category
}

module.exports = {
  normalizeMyntraTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
};
