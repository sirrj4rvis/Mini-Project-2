const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * ──────────────────────────────────────────────────────────────────────────────
 * Central user document. Stores credentials, preferences, and references
 * to the products they are tracking (watchlist).
 *
 * Relationships:
 *  - watchlist  → Product[]   (user tracks many products)
 *  - alerts     → Alert[]     (via userId in Alert — not stored here)
 *  - posts      → ForumPost[] (via userId in ForumPost — not stored here)
 *  - searches   → SearchHistory[] (via userId — not stored here)
 */
const userSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // NEVER returned in queries — must be explicitly requested
    },

    // ── Role & Status ─────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: { values: ['user', 'admin'], message: 'Role must be user or admin' },
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Quickly filter active/inactive users
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ── Profile ───────────────────────────────────────────────────────────────
    profilePic: {
      type: String,
      default: '',
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      default: '',
    },

    // ── Watchlist: products the user is tracking ──────────────────────────────
    watchlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    // ── Notification Preferences ──────────────────────────────────────────────
    notificationPrefs: {
      email: { type: Boolean, default: true },
      priceDrops: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
      forumReplies: { type: Boolean, default: true },
    },

    // ── Auth Tokens ───────────────────────────────────────────────────────────
    refreshToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// email is already unique (indexed). Add a partial index for admin queries.
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// ─── Pre-save Hook: Hash Password Before Saving ───────────────────────────────
// Only runs when the password field is actually modified.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance Method: Compare Passwords ───────────────────────────────────────
// Usage: const isMatch = await user.comparePassword(candidatePassword)
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance Method: Safe JSON Output (strip secrets) ────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.emailVerifyToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
