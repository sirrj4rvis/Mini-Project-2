'use strict';

const mongoose = require('mongoose');

/**
 * Alert Schema — Production Price Alert System
 * ─────────────────────────────────────────────────────────────────────────────
 * Supports two trigger modes:
 *   1. targetPrice   — Trigger when price drops AT OR BELOW a fixed rupee/$ value
 *   2. targetPctDrop — Trigger when price drops by at least N% from current price
 *
 * Lifecycle:
 *   isActive:  true  → alert is live and checked every cron cycle
 *   triggered: true  → condition met; email dispatched (alert auto-deactivates)
 *   isActive:  false → manually paused by user OR re-armed after cooldown
 *
 * Cooldown:
 *   Re-trigger is blocked for `cooldownHours` after last notification to prevent
 *   spam on volatile products. Default: 24h.
 */
const alertSchema = new mongoose.Schema(
  {
    // ── References ─────────────────────────────────────────────────────────────
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'userId is required'],
      index:    true,
    },
    productId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Product',
      required: [true, 'productId is required'],
      index:    true,
    },

    // ── Trigger Conditions ────────────────────────────────────────────────────
    targetPrice: {
      type:    Number,
      default: null,
      min:     [0, 'Target price must be positive'],
    },
    // Percentage drop trigger: e.g. 10 = "alert when price drops ≥10%"
    targetPctDrop: {
      type:    Number,
      default: null,
      min:     [0.1, 'Minimum pct drop is 0.1%'],
      max:     [95,  'Maximum pct drop is 95%'],
    },
    // Baseline price captured when alert was created (used for pct calculation)
    baselinePrice: {
      type:    Number,
      default: null,
    },
    // Restrict to a specific platform or 'any'
    platform: {
      type:    String,
      enum:    ['amazon', 'flipkart', 'ebay', 'meesho', 'myntra', 'snapdeal', 'any'],
      default: 'any',
    },

    // ── Lifecycle State ──────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
    triggered: {
      type:    Boolean,
      default: false,
    },
    triggeredAt: {
      type:    Date,
      default: null,
    },
    triggeredPrice: {
      type:    Number,
      default: null,
    },
    triggeredPlatform: {
      type:    String,
      default: null,
    },
    // How many times this alert has fired total (for recurring alerts)
    triggerCount: {
      type:    Number,
      default: 0,
    },

    // ── Notification Settings ────────────────────────────────────────────────
    notificationSent: {
      type:    Boolean,
      default: false,
    },
    notificationSentAt: {
      type:    Date,
      default: null,
    },
    // Hours to wait before re-triggering same alert (prevents email spam)
    cooldownHours: {
      type:    Number,
      default: 24,
      min:     1,
      max:     168, // 1 week max
    },
    // Allow the alert to re-trigger after cooldown (vs. one-shot)
    recurring: {
      type:    Boolean,
      default: true,
    },
    // Last time the cron checked this alert (audit)
    lastCheckedAt: {
      type:    Date,
      default: null,
    },
    // Optional user note ("Save for birthday gift")
    note: {
      type:    String,
      maxlength: 200,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// Primary cron query: all active, untriggered (or cooldown-expired) alerts
alertSchema.index({ isActive: 1, triggered: 1, notificationSentAt: 1 });
// Dashboard query: all alerts for a user
alertSchema.index({ userId: 1, createdAt: -1 });
// Product-level query: all alerts watching a product
alertSchema.index({ productId: 1, isActive: 1 });
// Compound unique: one active alert per user/product/platform combo
alertSchema.index(
  { userId: 1, productId: 1, platform: 1 },
  { unique: true, name: 'unique_user_product_platform_alert' }
);
// HIGH-SPEED: cron queries user + product in the same pass — compound covers both
alertSchema.index({ userId: 1, productId: 1, isActive: 1 });

// ── Virtuals ─────────────────────────────────────────────────────────────────
alertSchema.virtual('isInCooldown').get(function () {
  if (!this.notificationSentAt) return false;
  const cooldownMs = this.cooldownHours * 60 * 60 * 1000;
  return Date.now() - this.notificationSentAt.getTime() < cooldownMs;
});

// ── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Check whether a given current price satisfies this alert's conditions.
 * Returns { triggered: bool, savingsAmt: number, savingsPct: number }
 */
alertSchema.methods.evaluatePrice = function (currentPrice) {
  if (!currentPrice || currentPrice <= 0) return { triggered: false };

  let triggered     = false;
  let savingsAmt    = 0;
  let savingsPct    = 0;
  let triggerReason = '';

  // Fixed price trigger
  if (this.targetPrice !== null && currentPrice <= this.targetPrice) {
    triggered     = true;
    savingsAmt    = Math.max(0, (this.baselinePrice || this.targetPrice) - currentPrice);
    savingsPct    = this.baselinePrice
      ? ((this.baselinePrice - currentPrice) / this.baselinePrice) * 100
      : 0;
    triggerReason = `Price dropped to ₹${currentPrice} (target: ₹${this.targetPrice})`;
  }

  // Percentage drop trigger
  if (!triggered && this.targetPctDrop !== null && this.baselinePrice) {
    const actualDrop = ((this.baselinePrice - currentPrice) / this.baselinePrice) * 100;
    if (actualDrop >= this.targetPctDrop) {
      triggered     = true;
      savingsAmt    = this.baselinePrice - currentPrice;
      savingsPct    = actualDrop;
      triggerReason = `Price dropped ${actualDrop.toFixed(1)}% (target: ${this.targetPctDrop}%)`;
    }
  }

  return {
    triggered,
    savingsAmt:    Math.round(savingsAmt * 100) / 100,
    savingsPct:    Math.round(savingsPct * 100) / 100,
    triggerReason,
  };
};

/**
 * Re-arm a recurring alert after cooldown (resets triggered state).
 */
alertSchema.methods.rearm = async function () {
  this.triggered          = false;
  this.notificationSent   = false;
  return this.save();
};

module.exports = mongoose.model('Alert', alertSchema);

