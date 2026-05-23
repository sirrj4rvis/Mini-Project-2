const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Admin Schema
 * ──────────────────────────────────────────────────────────────────────────────
 * A SEPARATE collection for admin accounts — not mixed with regular users.
 *
 * WHY separate from User?
 *   Mixing admin and user records in one collection creates security risk.
 *   A bug in a query filter (e.g. missing role: 'admin' check) could
 *   accidentally expose admin data. Separation enforces strict isolation.
 *
 * Capabilities tracked here:
 *   - Which admin performed which actions (audit log)
 *   - What permissions each admin has (role-based access)
 *   - Login activity for security monitoring
 *
 * Relationships:
 *  - auditLog[].targetId → any collection (User, Product, ForumPost, etc.)
 */
const auditLogEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      // e.g. 'BAN_USER', 'DELETE_POST', 'UPDATE_PRODUCT', 'GRANT_ADMIN'
    },
    targetCollection: {
      type: String,
      required: true,
      // e.g. 'User', 'ForumPost', 'Product'
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const adminSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true,
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
      minlength: [12, 'Admin password must be at least 12 characters'],
      select: false,
    },

    // ── Permission Levels ────────────────────────────────────────────────────
    // 'super' can create/delete admins. 'moderator' only manages content.
    adminRole: {
      type: String,
      enum: {
        values: ['super', 'moderator', 'analyst'],
        message: 'adminRole must be super, moderator, or analyst',
      },
      default: 'moderator',
    },
    permissions: {
      manageUsers: { type: Boolean, default: true },
      manageProducts: { type: Boolean, default: true },
      manageForum: { type: Boolean, default: true },
      viewAnalytics: { type: Boolean, default: true },
      manageAdmins: { type: Boolean, default: false }, // only 'super'
    },

    // ── Security & Status ────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    // Lock account after too many failed attempts
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    // ── Audit Log ────────────────────────────────────────────────────────────
    // Rolling log of the last 100 admin actions for accountability.
    // For full audit history, use a dedicated AuditLog collection in production.
    auditLog: {
      type: [auditLogEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
adminSchema.index({ adminRole: 1, isActive: 1 });

// ─── Pre-save Hook: Hash Password ─────────────────────────────────────────────
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 14); // Higher cost for admins
  next();
});

// ─── Instance Method: Compare Password ────────────────────────────────────────
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance Method: Log Action ─────────────────────────────────────────────
// Usage: await admin.logAction('DELETE_POST', 'ForumPost', postId, 'Spam')
adminSchema.methods.logAction = async function (
  action,
  targetCollection,
  targetId,
  description = '',
  ipAddress = ''
) {
  this.auditLog.push({ action, targetCollection, targetId, description, ipAddress });
  // Keep only last 100 entries (rolling window)
  if (this.auditLog.length > 100) {
    this.auditLog = this.auditLog.slice(-100);
  }
  return this.save();
};

// ─── Virtual: Is Account Locked ───────────────────────────────────────────────
adminSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

module.exports = mongoose.model('Admin', adminSchema);
