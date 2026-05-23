/**
 * Product Popularity Analyzer.
 * Measures true engagement by evaluating review density and rating quality.
 * Prevents low-quality items with 5 fake reviews from beating items with 10,000 real reviews.
 */
class ProductPopularityAnalyzer {
  /**
   * Generates a normalized popularity metric.
   * @param {Object} product 
   * @returns {number} Score representing market popularity
   */
  static getPopularityScore(product) {
    const reviews = product.reviewCount || product.reviews || 0;
    const rating = product.rating || 0;

    if (reviews === 0 || rating === 0) return 0;

    // Use logarithmic scaling for review counts.
    // 10 reviews vs 100 reviews is a huge difference. 
    // 10,000 vs 10,100 reviews is statistically irrelevant.
    const reviewScore = Math.log10(reviews + 1) * 10;
    
    // Normalize rating as a percentage multiplier (e.g., 4.5/5.0 = 0.9)
    const ratingMultiplier = rating / 5.0;

    // Final Popularity = Scaled Volume * Quality
    return parseFloat((reviewScore * ratingMultiplier).toFixed(2));
  }
}

module.exports = ProductPopularityAnalyzer;
