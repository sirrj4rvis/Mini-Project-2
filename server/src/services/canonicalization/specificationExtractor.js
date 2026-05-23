/**
 * Extracts structured hardware/fashion specifications (e.g., RAM, Storage, Size, Color)
 * directly from messy product titles.
 */

class SpecificationExtractor {
  /**
   * Scans a standardized title and returns structured spec objects.
   * @param {string} title 
   * @returns {Object} specs
   */
  static extract(title) {
    const specs = {};
    const t = title.toLowerCase();

    // ── 1. Electronics Specs ──
    
    // Storage Detection (e.g., 128GB, 1TB, 512 GB)
    const storageMatch = t.match(/\b(\d+)\s*(gb|tb)\b/i);
    if (storageMatch) specs.storage = `${storageMatch[1]}${storageMatch[2].toUpperCase()}`;

    // RAM Detection (e.g., 8GB RAM)
    const ramMatch = t.match(/\b(\d+)\s*(gb)\s*ram\b/i);
    if (ramMatch) {
      specs.ram = `${ramMatch[1]}GB`;
    } else {
      // Heuristic: If it's a small GB value not labeled RAM, it might be RAM
      const gbMatches = [...t.matchAll(/\b(\d+)\s*gb\b/gi)];
      for (const match of gbMatches) {
        const val = parseInt(match[1], 10);
        // If it's <= 64GB and doesn't match the storage we already found, assume it's RAM
        if (val <= 64 && val !== parseInt(specs.storage)) {
          specs.ram = `${val}GB`;
        }
      }
    }

    // Display Size Detection (e.g., 15.6", 15.6 inch)
    const inchMatch = t.match(/\b(\d+\.?\d*)\s*(inch|"|'')\b/i);
    if (inchMatch) specs.screenSize = `${inchMatch[1]}"`;

    // ── 2. Fashion Specs ──
    
    // Size Detection (Small, Medium, Large, XL, XXL)
    const sizeMatch = t.match(/\b(small|medium|large|xl|xxl|xxxl)\b/i);
    if (sizeMatch) specs.apparelSize = sizeMatch[1].toUpperCase();

    // Color Detection
    const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'silver', 'grey', 'gray', 'gold', 'pink', 'purple'];
    for (const color of colors) {
      if (new RegExp(`\\b${color}\\b`, 'i').test(t)) {
        specs.color = color.charAt(0).toUpperCase() + color.slice(1);
        break; // Only capture primary color
      }
    }

    return specs;
  }
}

module.exports = SpecificationExtractor;
