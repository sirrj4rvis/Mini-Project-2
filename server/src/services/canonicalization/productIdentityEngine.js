const TitleStandardizer = require('./titleStandardizer');
const SpecificationExtractor = require('./specificationExtractor');

/**
 * Parses a product to detect its Brand, Model Name, and generate a unique structural signature.
 */
class ProductIdentityEngine {
  
  // Localized database of high-volume ecommerce brands
  static KNOWN_BRANDS = [
    'apple', 'samsung', 'sony', 'logitech', 'dell', 'hp', 'lenovo', 
    'asus', 'acer', 'microsoft', 'google', 'oneplus', 'xiaomi', 'boat',
    'nike', 'adidas', 'puma', 'levi', 'zara', 'jbl', 'bose'
  ];

  /**
   * Generates a canonical identity fingerprint for a raw product.
   */
  static generateIdentity(rawProduct) {
    const stdTitle = TitleStandardizer.standardize(rawProduct.title || '');
    
    // ── 1. Brand Extraction ──
    let brand = rawProduct.brand || null;
    if (!brand) {
      for (const b of this.KNOWN_BRANDS) {
        // If the standardized title contains the brand name, extract it
        if (stdTitle.includes(b)) {
          brand = b.charAt(0).toUpperCase() + b.slice(1);
          break;
        }
      }
    }

    // ── 2. Model Detection ──
    // Heuristic: Alphanumeric strings usually denote distinct product models (e.g. G102, iPhone 13, XPS 15)
    // We look for uppercase alphanumeric blocks in the raw title
    const modelRegex = /\b([A-Z0-9]{2,}[-]*[A-Z0-9]*)\b/g;
    const uppercaseTitle = rawProduct.title ? rawProduct.title.toUpperCase() : '';
    let models = uppercaseTitle.match(modelRegex) || [];
    
    // Filter out common fake-models that are actually specs
    models = models.filter(m => !/GB|TB|SSD|HDD|RAM|LED|LCD|USB|Type-C/i.test(m));
    const primaryModel = models.length > 0 ? models[0] : null;

    // ── 3. Specification Parsing ──
    const specs = SpecificationExtractor.extract(stdTitle);

    // ── 4. Canonical Signature Generation ──
    // Creates a unique hash/string to cluster identical products
    // e.g. "logitech-g102-black"
    const sigParts = [];
    if (brand) sigParts.push(brand.toLowerCase());
    if (primaryModel) sigParts.push(primaryModel.toLowerCase());
    if (specs.storage) sigParts.push(specs.storage.toLowerCase());
    if (specs.ram) sigParts.push(specs.ram.toLowerCase() + 'ram');
    if (specs.color) sigParts.push(specs.color.toLowerCase());

    const signature = sigParts.length > 0 ? sigParts.join('-') : stdTitle.replace(/\s+/g, '-').substring(0, 25);

    return {
      brand: brand || 'Unknown',
      model: primaryModel,
      specs,
      signature,
      standardizedTitle: stdTitle
    };
  }
}

module.exports = ProductIdentityEngine;
