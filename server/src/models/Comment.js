const mongoose = require('mongoose');

/**
 * Comment Schema (Standalone Collection)
 * ──────────────────────────────────────────────────────────────────────────────
 * Extracted from ForumPost into its own collection for scalability.
 *
 * WHY separate from ForumPost?
 *   Embedding comments inside ForumPost works fine for small numbers, but a
 *   viral post could have thousands of comments, making the parent document
 *   huge and slow. A separate collection lets us paginate comments efficiently.
 *
 * Relationships:
 *  - postId  → ForumPost (the post this comment belongs to)
 *  - userId  → User      (the author)
 *  - parentId → Comment  (optional — enables threaded replies)
 */
const commentSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumPost',
      required: [true, 'postId is required'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },
    // Enables nested replies (one level deep is usually enough)
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },

    // ── Engagement ────────────────────────────────────────────────────────────
    // Store user IDs so we can prevent double-voting and show vote count
    upvotes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ── Moderation ───────────────────────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtual: upvote count ───────────────────────────────────────────────────
// Avoids storing a separate counter that can get out of sync
commentSchema.virtual('upvoteCount').get(function () {
  return this.upvotes.length;
});

commentSchema.virtual('downvoteCount').get(function () {
  return this.downvotes.length;
});

commentSchema.virtual('score').get(function () {
  return this.upvotes.length - this.downvotes.length;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Primary: "get all top-level comments for this post, newest first"
commentSchema.index({ postId: 1, parentId: 1, createdAt: -1 });

// "get all comments written by this user" (for profile page)
commentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
