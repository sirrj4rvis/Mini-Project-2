const mongoose = require('mongoose');

/**
 * PriceHistory Schema
 * ──────────────────────────────────────────────────────────────────────────────
 * Append-only time-series collection. Every time the cron job scrapes a
 * product, it inserts ONE document here per platform. Never updated — only
 * inserted and queried.
 *
 * Why a separate collection (not embedded in Product)?
 *   A product can have thousands of price snapshots over its lifetime.
 *   Embedding would cause the Product document to grow unbounded, slowing
 *   every product lookup. A separate collection scales infinitely.
 *
 * Relationships:
 *  - productId → Product (the product this price belongs to)
 */
const priceHistorySchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required'],
      index: true,
    },

    // ── Snapshot Data ────────────────────────────────────────────────────────
    platform: {
      type: String,
      required: [true, 'Platform is required'],
      enum: {
        values: ['amazon', 'flipkart', 'ebay', 'walmart', 'other'],
        message: '{VALUE} is not a supported platform',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
      default: null,
    },
    currency: {
      type: String,
      default: 'INR',
      maxlength: [3, 'Currency code must be 3 characters'],
    },
    availability: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'limited'],
      default: 'in_stock',
    },

    // ── Timestamp ─────────────────────────────────────────────────────────────
    // Using 'timestamp' as the createdAt alias so ML/charts can query by it.
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // No updatedAt — this collection is append-only (immutable records)
    timestamps: { createdAt: 'timestamp', updatedAt: false },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// PRIMARY: "give me all prices for product X on platform Y sorted by time"
// This single compound index covers chart queries, ML training data, and alerts.
priceHistorySchema.index({ productId: 1, platform: 1, timestamp: -1 });

// For querying all history of a product across all platforms (chart view)
priceHistorySchema.index({ productId: 1, timestamp: -1 });

// TTL Index: auto-delete records older than 2 years (63,072,000 seconds)
// Keeps the collection lean. Remove this if you want infinite history.
priceHistorySchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 63_072_000 }
);

// ─── Static Method: Get History for ML ───────────────────────────────────────
// Returns flat array of { date, price } formatted for the ML microservice.
// Usage: const data = await PriceHistory.getForML(productId)
priceHistorySchema.statics.getForML = function (productId) {
  return this.find({ productId })
    .sort({ timestamp: 1 })
    .select('price timestamp -_id')
    .lean()
    .then((records) =>
      records.map((r) => ({
        date: r.timestamp.toISOString().split('T')[0],
        price: r.price,
      }))
    );
};

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
