/**
 * Buying Decision Engine.
 * Analyzes historical price volatility to definitively answer: "Should I buy this today?"
 */
class BuyingDecisionEngine {
  /**
   * Generates a definitive BUY_NOW or WAIT recommendation.
   * 
   * @param {Object} product - The current product
   * @param {Array} history - Array of { date, price } objects
   * @returns {Object} Recommendation payload
   */
  static evaluate(product, history = []) {
    const currentPrice = product.price || product.bestPrice || 0;
    
    // If we lack history, default to neutral
    if (!history || history.length < 5 || currentPrice === 0) {
      return { action: 'WAIT', confidence: 50, reason: 'Insufficient historical data' };
    }

    // Sort history chronologically and extract recent trends
    const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const recentPrices = sortedHistory.slice(-14).map(h => h.price); // Analyze last 14 days
    
    const minPrice = Math.min(...recentPrices);
    const avgPrice = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;

    // Calculate how the current price deviates from the moving average
    const discountFromAvg = ((avgPrice - currentPrice) / avgPrice) * 100;

    let action = 'WAIT';
    let confidence = 50;
    let reason = 'Price is average. Wait for a drop.';

    // ── Strategic Buying Rules ──
    if (currentPrice <= minPrice) {
      action = 'BUY_NOW';
      confidence = 95;
      reason = 'Price is at a 14-day absolute low.';
    } else if (discountFromAvg > 8) {
      // It's 8%+ cheaper than it usually is
      action = 'BUY_NOW';
      confidence = 80;
      reason = `Price is ${discountFromAvg.toFixed(1)}% below the 14-day average.`;
    } else if (discountFromAvg < -10) {
      // It's currently 10%+ more expensive than usual (inflated for a fake sale)
      action = 'WAIT';
      confidence = 90;
      reason = 'Price is artificially inflated. Do not buy.';
    }

    return { action, confidence, reason };
  }
}

module.exports = BuyingDecisionEngine;
