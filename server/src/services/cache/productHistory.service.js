const mongoose = require('mongoose');
const logger = require('../shared/logger');

// ── Mongoose Schema Definition ───────────────────────────────────────────────
// Tracks the price of an item over time. Used by the ML engine to predict trends.
const PricePointSchema = new mongoose.Schema({
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const ProductHistorySchema = new mongoose.Schema({
  normalizedTitle: { type: String, required: true, unique: true, index: true },
  category: { type: String },
  priceHistory: { type: [PricePointSchema], default: [] }, // Array of historical prices
  lastSeen: { type: Date, default: Date.now }
});

// Compound index for extremely fast chronological lookups
ProductHistorySchema.index({ normalizedTitle: 1, 'priceHistory.timestamp': -1 });

const ProductHistory = mongoose.models.ProductHistory || mongoose.model('ProductHistory', ProductHistorySchema);

/**
 * Records a single price data point for a unified product.
 * Automatically pushes to the historical array.
 */
async function trackProductHistory(product) {
  try {
    if (!product || !product.normalizedTitle || !product.price) return;

    // Bug 4 fix: Plain $push is unbounded — can grow the document to the 16MB BSON limit.
    // $slice: -365 keeps only the last 365 price points (one full year of daily history)
    // while still allowing any size of preceding history to be pruned efficiently.
    await ProductHistory.findOneAndUpdate(
      { normalizedTitle: product.normalizedTitle },
      { 
        $push: {
          priceHistory: {
            $each: [{ price: product.price, timestamp: new Date() }],
            $slice: -365  // Retain only the most recent 365 data points
          }
        },
        $set: { lastSeen: new Date(), category: product.category }
      },
      { upsert: true }
    );
  } catch (error) {
    logger.error(`[ProductHistory] Error tracking price for "${product.normalizedTitle}": ${error.message}`);
  }
}

/**
 * Accepts an array of newly scraped unified products and fires history tracking in the background.
 * Uses fire-and-forget logic so it doesn't slow down the main API response.
 */
async function batchTrackHistory(unifiedProducts) {
  try {
    await Promise.allSettled(unifiedProducts.map(p => trackProductHistory(p)));
  } catch (error) {
    logger.error(`[ProductHistory] Batch setup error: ${error.message}`);
  }
}

/**
 * Retrieves the full chronological price curve for a specific product.
 */
async function getProductHistory(normalizedTitle) {
  try {
    const history = await ProductHistory.findOne({ normalizedTitle }).lean();
    return history ? history.priceHistory : [];
  } catch (error) {
    logger.error(`[ProductHistory] Error fetching history for "${normalizedTitle}": ${error.message}`);
    return [];
  }
}

module.exports = { trackProductHistory, batchTrackHistory, getProductHistory };
