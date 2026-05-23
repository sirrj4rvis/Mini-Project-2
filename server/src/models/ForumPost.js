const mongoose = require('mongoose');

/**
 * ForumPost Schema
 * ──────────────────────────────────────────────────────────────────────────────
 * Represents a community discussion thread. Comments are stored in the
 * separate Comment collection (not embedded here) for scalability.
 * The commentCount field is a cached counter updated by the Comment controller.
 *
 * Relationships:
 *  - userId    → User     (author of the post)
 *  - productId → Product  (optional — post can be linked to a product)
 *  - upvotes[] → User[]   (users who upvoted)
 *  - comments  → Comment[] (separate collection — query by postId)
 */
const forumPostSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },
    // Optional: link post to a specific product (e.g. "Best deal on iPhone?")
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Post body is required'],
      trim: true,
      minlength: [10, 'Post must be at least 10 characters'],
      maxlength: [10000, 'Post cannot exceed 10,000 characters'],
    },
    // Tags for filtering: ['deal', 'question', 'review', 'iphone', ...]
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
        maxlength: [30, 'Tag cannot exceed 30 characters'],
      },
    ],

    // ── Engagement ────────────────────────────────────────────────────────────
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Cached counter — incremented/decremented by Comment controller
    // Avoids expensive COUNT queries on the Comment collection
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Moderation ────────────────────────────────────────────────────────────
    isPinned: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false, // Locked posts cannot receive new comments
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Admin who moderated this post (if flagged/removed)
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtual: upvote count ────────────────────────────────────────────────────
forumPostSchema.virtual('upvoteCount').get(function () {
  return this.upvotes.length;
});

forumPostSchema.virtual('downvoteCount').get(function () {
  return this.downvotes.length;
});

forumPostSchema.virtual('score').get(function () {
  return this.upvotes.length - this.downvotes.length;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Full-text search: "search posts about laptops under ₹50k"
forumPostSchema.index({ title: 'text', body: 'text', tags: 'text' });

// Browse feed: newest posts first (default home page view)
forumPostSchema.index({ createdAt: -1 });

// Filter by product: "all posts about this product"
forumPostSchema.index({ productId: 1, createdAt: -1 });

// Admin moderation: filter deleted / pinned
forumPostSchema.index({ isDeleted: 1, isPinned: -1, createdAt: -1 });

// User's own posts (profile page)
forumPostSchema.index({ userId: 1, createdAt: -1 });

// Tag filtering: "show all posts tagged 'deals'"
forumPostSchema.index({ tags: 1, createdAt: -1 });

module.exports = mongoose.model('ForumPost', forumPostSchema);
