const mongoose = require('mongoose');

/**
 * Source Sub-Document
 * ──────────────────────────────────────────────────────────────────────────────
 * One entry per ecommerce platform (Amazon, eBay, etc.).
 * Stores the most recently scraped price, link, and metadata.
 * { _id: false } because these are embedded and don't need their own ID.
 */
const sourceSchema = new mongoose.Schema(
  {
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
    currency: { type: String, default: 'INR', maxlength: 3 },
    originalCurrencyPrice: { type: Number },
    originalCurrency: { type: String, maxlength: 3 },
    convertedPriceINR: { type: Number },
    exchangeRateUsed: { type: Number, default: 1 },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    discount: { type: Number, default: 0, min: 0, max: 100 }, // Percentage
    link: {
      type: String,
      required: [true, 'Product link is required'],
      trim: true,
    },
    availability: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'limited'],
      default: 'in_stock',
    },
    rating: { type: Number, min: 0, max: 5, default: null },
    reviewCount: { type: Number, default: 0, min: 0 },
    seller: { type: String, default: '', trim: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false } // No separate _id for embedded sub-docs
);

/**
 * Product Schema
 * ──────────────────────────────────────────────────────────────────────────────
 * Core entity of the platform. A single product document aggregates price
 * data from all scraped platforms into one unified record.
 *
 * Relationships:
 *  - sources[]     → embedded (platform prices, no separate collection)
 *  - PriceHistory  → productId ref (separate time-series collection)
 *  - Alert         → productId ref (user alerts watching this product)
 *  - ForumPost     → productId ref (discussions about this product)
 *  - SearchHistory → productId ref (which users searched/clicked this)
 */
const productSchema = new mongoose.Schema(
  {
    // ── Core Identity ────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [500, 'Title cannot exceed 500 characters'],
    },
    normalizedTitle: {
      type: String,
      lowercase: true,
      trim: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Brand name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      default: 'Electronics',
      trim: true,
      index: true,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    // ── Platform Sources (embedded array) ────────────────────────────────────
    // Each element = one marketplace's current price snapshot.
    sources: {
      type: [sourceSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'A product must have at least one source',
      },
    },

    // ── Derived Price Aggregates ─────────────────────────────────────────────
    // Recomputed every time sources change (via pre-save hook).
    // Stored so we can query/sort by price WITHOUT scanning sources array.
    lowestPrice: { type: Number, default: 0, min: 0 },
    highestPrice: { type: Number, default: 0, min: 0 },
    averagePrice: { type: Number, default: 0, min: 0 },
    bestDealPlatform: { type: String, default: '' },

    // ── Search & Discovery ───────────────────────────────────────────────────
    searchKeywords: [{ type: String, lowercase: true, trim: true }],
    asin: {
      type: String,
      sparse: true,   // Allows nulls but indexes non-null values uniquely
      trim: true,
    },
    searchCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,    // For "Trending Products" queries (sort by popularity)
    },

    // ── ML / Prediction Metadata ─────────────────────────────────────────────
    lastPredictedPrice: { type: Number, default: null },
    priceDirection: {
      type: String,
      enum: ['rising', 'falling', 'stable', 'unknown'],
      default: 'unknown',
    },
    lastScrapedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Unique deduplication key: upsertProduct uses findOneAndUpdate({ normalizedTitle })
// Without a unique index, two concurrent requests can race and create duplicates.
// sparse: true allows multiple docs with null normalizedTitle during migration.
productSchema.index({ normalizedTitle: 1 }, { unique: true, sparse: true });
// Full-text search across title, brand, and keywords
productSchema.index({ title: 'text', searchKeywords: 'text', brand: 'text' });
productSchema.index({ lowestPrice: 1 });      // Price range filters
productSchema.index({ category: 1, lowestPrice: 1 }); // Category + price combo
productSchema.index({ searchCount: -1 });     // Trending products
productSchema.index({ lastScrapedAt: -1 });   // Stale data cleanup queries

// ─── Pre-save Hook: Auto-compute Aggregates ───────────────────────────────────
// Every time a product is saved, recompute the price summary fields.
// This keeps lowestPrice/highestPrice always accurate without extra queries.
productSchema.pre('save', function (next) {
  if (this.sources && this.sources.length > 0) {
    const prices = this.sources.map((s) => s.price);
    this.lowestPrice = Math.min(...prices);
    this.highestPrice = Math.max(...prices);
    this.averagePrice =
      Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
    this.bestDealPlatform = this.sources.reduce((prev, curr) =>
      prev.price < curr.price ? prev : curr
    ).platform;
    this.normalizedTitle = this.title.toLowerCase().trim();
  }
  next();
});

// ─── Static Method: Find Trending ────────────────────────────────────────────
// Usage: const trending = await Product.findTrending(10)
productSchema.statics.findTrending = function (limit = 12) {
  return this.find({ searchCount: { $gt: 0 } })
    .sort({ searchCount: -1 })
    .limit(limit)
    .lean();
};

// ─── Static Method: Find Stale Products ──────────────────────────────────────
// Usage: const stale = await Product.findStale(7) — products not seen in 7 days
productSchema.statics.findStale = function (ageDays = 7) {
  const threshold = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  return this.find({ lastScrapedAt: { $lt: threshold } })
    .select('_id title normalizedTitle lastScrapedAt')
    .lean();
};

module.exports = mongoose.model('Product', productSchema);
