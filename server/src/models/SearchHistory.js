const mongoose = require('mongoose');

/**
 * SearchHistory Schema
 * ──────────────────────────────────────────────────────────────────────────────
 * Records every search and product click by a user (or anonymous session).
 * Used for three purposes:
 *   1. Personal history: "Your recent searches" on the user dashboard
 *   2. Analytics: "What are users searching for?" for the admin dashboard
 *   3. ML training: search patterns help improve product recommendations
 *
 * Design note: This is a high-write, low-read collection.
 * We use a TTL index to auto-expire old records (90 days) to keep it lean.
 *
 * Relationships:
 *  - userId    → User    (null if anonymous / not logged in)
 *  - productId → Product (null if search returned no result or user only searched)
 */
const searchHistorySchema = new mongoose.Schema(
  {
    // ── Who searched ─────────────────────────────────────────────────────────
    // Nullable: we also track anonymous searches (for analytics)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Session ID for anonymous users (from browser fingerprint / cookie)
    sessionId: {
      type: String,
      default: null,
      trim: true,
    },

    // ── What was searched ─────────────────────────────────────────────────────
    query: {
      type: String,
      required: [true, 'Search query is required'],
      trim: true,
      lowercase: true,
      maxlength: [200, 'Search query cannot exceed 200 characters'],
    },
    // Normalized for deduplication/analytics (remove special chars, extra spaces)
    normalizedQuery: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // ── What was clicked ─────────────────────────────────────────────────────
    // Set when user clicks a product from the results (not just searches)
    clickedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    clickedProductTitle: {
      type: String,
      default: null,
    },

    // ── Result Metadata ───────────────────────────────────────────────────────
    resultCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Which filters were applied during search
    appliedFilters: {
      category: { type: String, default: null },
      priceMin: { type: Number, default: null },
      priceMax: { type: Number, default: null },
      platform: { type: String, default: null },
    },

    // ── Context ───────────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web',
    },
    ipAddress: {
      type: String,
      default: '',
      select: false, // Privacy: not returned in normal queries
    },

    // ── Timestamp ─────────────────────────────────────────────────────────────
    searchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Only createdAt needed (append-only)
    timestamps: { createdAt: 'searchedAt', updatedAt: false },
  }
);

// ─── Pre-save Hook: Normalize Query ───────────────────────────────────────────
// Strip special characters for accurate analytics grouping
searchHistorySchema.pre('save', function (next) {
  if (this.query) {
    this.normalizedQuery = this.query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  next();
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// User history: "show me my recent searches"
searchHistorySchema.index({ userId: 1, searchedAt: -1 });

// Analytics: "what are the most searched terms today?"
searchHistorySchema.index({ normalizedQuery: 1, searchedAt: -1 });

// Product analytics: "which products get the most clicks?"
searchHistorySchema.index({ clickedProductId: 1, searchedAt: -1 });

// TTL Index: auto-delete records older than 90 days (7,776,000 seconds)
// Keeps this high-write collection from growing out of control
searchHistorySchema.index(
  { searchedAt: 1 },
  { expireAfterSeconds: 7_776_000 }
);

// ─── Static Method: Top Searches (for admin analytics dashboard) ──────────────
// Usage: const top = await SearchHistory.getTopQueries(7, 10)
searchHistorySchema.statics.getTopQueries = function (days = 7, limit = 10) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { searchedAt: { $gte: since } } },
    { $group: { _id: '$normalizedQuery', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { query: '$_id', count: 1, _id: 0 } },
  ]);
};

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
