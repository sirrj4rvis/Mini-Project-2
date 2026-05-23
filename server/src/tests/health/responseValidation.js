/**
 * Validation rules and checks to ensure products strictly adhere to the 
 * Unified Product Schema and contain high-quality data.
 */

/**
 * Validates a single product against structural requirements.
 */
function validateProduct(product) {
  const errors = [];
  const warnings = [];

  // ── Critical Structural Checks (Must not be missing) ──
  if (!product.title) errors.push('Missing title');
  if (!product.normalizedTitle) errors.push('Missing normalizedTitle');
  if (product.price === undefined || product.price === null) errors.push('Missing price');
  if (product.price <= 0) errors.push('Invalid price (<= 0)');
  if (!product.currency) errors.push('Missing currency');
  if (!product.source) errors.push('Missing source');
  if (!product.link) errors.push('Missing link');

  // ── Quality Warning Checks (Can be missing, but lowers quality score) ──
  if (!product.image) warnings.push('Missing image URL');
  if (product.rating === undefined || product.rating === null) warnings.push('Missing rating');
  if (product.reviewCount === undefined || product.reviewCount === null) warnings.push('Missing reviewCount');
  if (!product.category) warnings.push('Missing category');

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Scans an array of products for internal exact duplicates.
 * A healthy source should not return the exact same item twice in one page (pagination loops/bot traps).
 */
function detectDuplicates(products) {
  const uniqueTitles = new Set();
  const duplicates = [];

  for (const p of products) {
    if (!p.title) continue;
    const key = p.title.toLowerCase();
    if (uniqueTitles.has(key)) {
      duplicates.push(p.title);
    } else {
      uniqueTitles.add(key);
    }
  }

  return duplicates;
}

module.exports = { validateProduct, detectDuplicates };
