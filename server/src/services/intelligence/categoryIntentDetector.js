/**
 * Category & Keyword Intent Detector.
 * Determines the true context of the search query (e.g., distinguishing a search 
 * for a high-end gaming machine vs. a cheap office accessory).
 */

class CategoryIntentDetector {
  /**
   * Analyzes a query string and returns a structured intent object.
   */
  static detect(query) {
    const q = query.toLowerCase();
    
    const intent = {
      primaryCategory: 'Unknown',
      isCheap: false,
      isPremium: false,
      isGaming: false,
      isAccessories: false,
      brandFocus: null
    };

    // ── 1. Category Routing ──
    if (/phone|mobile|iphone|samsung|pixel|smartphone/.test(q)) intent.primaryCategory = 'Mobiles';
    else if (/laptop|macbook|thinkpad|asus|acer/.test(q)) intent.primaryCategory = 'Laptops';
    else if (/shirt|jeans|hoodie|jacket|sneaker|shoes|apparel/.test(q)) intent.primaryCategory = 'Fashion';
    else if (/mouse|keyboard|monitor|gpu|cpu|ram/.test(q)) intent.primaryCategory = 'Computer Peripherals';
    else if (/tv|television|speaker|headphone|earbud/.test(q)) intent.primaryCategory = 'Electronics';

    // ── 2. Price Intent Detection ──
    if (/cheap|budget|under|low price|affordable/.test(q)) intent.isCheap = true;
    if (/premium|pro|ultra|max|expensive/.test(q)) intent.isPremium = true;

    // ── 3. Use-Case Intent ──
    if (/gaming|gamer|rgb/.test(q)) intent.isGaming = true;
    if (/charger|cable|case|cover|screen protector/.test(q)) intent.isAccessories = true;

    // ── 4. Brand Extraction ──
    const topBrands = ['apple', 'samsung', 'sony', 'logitech', 'dell', 'hp', 'lenovo', 'nike', 'adidas', 'puma', 'asus', 'acer'];
    for (const brand of topBrands) {
      if (q.includes(brand)) {
        intent.brandFocus = brand;
        break;
      }
    }

    return intent;
  }
}

module.exports = CategoryIntentDetector;
