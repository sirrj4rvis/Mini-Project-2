const { validateProduct, detectDuplicates } = require('./responseValidation');

/**
 * Validates the raw response payload from a specific source, aggregating 
 * quality metrics, error rates, and grading the source health.
 */
class SourceValidator {
  /**
   * Evaluates an array of scraped products and generates a unified health report.
   * 
   * @param {Array} products - Raw products returned from a source
   * @returns {Object} Quality metrics report
   */
  static generateReport(products) {
    if (!Array.isArray(products) || products.length === 0) {
      return {
        totalItems: 0,
        validItems: 0,
        qualityScore: 0,
        duplicatesFound: 0,
        missingImages: 0,
        missingRatings: 0,
        criticalErrors: ['Source returned empty array or invalid format (Possible DOM change / Bot Block)']
      };
    }

    let validCount = 0;
    let missingImages = 0;
    let missingRatings = 0;
    const allErrors = new Set();

    products.forEach((product) => {
      const { isValid, errors, warnings } = validateProduct(product);
      
      if (isValid) validCount++;
      
      errors.forEach(e => allErrors.add(e));
      
      if (warnings.includes('Missing image URL')) missingImages++;
      if (warnings.includes('Missing rating')) missingRatings++;
    });

    const duplicates = detectDuplicates(products);
    
    // ── Quality Score Algorithm ──
    // Base score is derived from the ratio of completely valid items.
    const completenessRatio = validCount / products.length;
    let qualityScore = completenessRatio * 100;

    // Deduct points for missing non-critical data (Degraded quality)
    const imageMissingRatio = missingImages / products.length;
    const ratingMissingRatio = missingRatings / products.length;
    const duplicateRatio = duplicates.length / products.length;

    qualityScore -= (imageMissingRatio * 20); // 20% penalty if NO images at all
    qualityScore -= (ratingMissingRatio * 10); // 10% penalty if NO ratings extracted
    qualityScore -= (duplicateRatio * 30); // Heavy penalty for duplicate spam (bad selectors)

    return {
      totalItems: products.length,
      validItems: validCount,
      qualityScore: Math.max(0, Math.min(Math.round(qualityScore), 100)),
      duplicatesFound: duplicates.length,
      missingImages,
      missingRatings,
      criticalErrors: Array.from(allErrors)
    };
  }
}

module.exports = SourceValidator;
