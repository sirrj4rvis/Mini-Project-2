'use strict';

/**
 * cronJobs.js — PriceLens Background Job Scheduler
 *
 * Schedules:
 *   Job 1 — Price Refresh        every 6h   (00:00, 06:00, 12:00, 18:00 UTC)
 *   Job 2 — Alert Evaluator      every 6h+5m (offset to run after refresh)
 *   Job 3 — Recurring Alert Rearm every 1h   (re-arms cooled-down recurring alerts)
 *   Job 4 — Weekly Digest        Sundays 08:00 UTC
 *   Job 5 — Data Cleanup         Daily  02:00 UTC
 *
 * All jobs are idempotent and wrapped in try/catch to prevent crashing the process.
 */

const cron        = require('node-cron');
const Product     = require('../models/Product');
const PriceHistory = require('../models/PriceHistory');
const Alert       = require('../models/Alert');
const User        = require('../models/User');
const { searchAmazonProducts }  = require('../services/amazonApiService');
const { getUsdToInrRate }       = require('../services/currencyService');
const { normalizeApiProduct }   = require('../services/aggregator/sourceManager');
const {
  sendPriceDropAlert,
  sendPriceSurgeWarning,
  sendWeeklyDigest,
  sendAlertRearmedEmail,
} = require('../services/mailerService');
const logger = require('../config/logger');

// ── Concurrency limiter — never slam APIs with too many parallel requests ─────
const BATCH_SIZE   = 5;   // Products refreshed concurrently
const ALERT_BATCH  = 20;  // Alerts evaluated concurrently

const runInBatches = async (items, fn, size = BATCH_SIZE) => {
  for (let i = 0; i < items.length; i += size) {
    await Promise.allSettled(items.slice(i, i + size).map(fn));
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Job 1: Price Refresh
// ─────────────────────────────────────────────────────────────────────────────
const priceRefreshJob = async () => {
  const start = Date.now();
  logger.info('[CronJob:PriceRefresh] Starting...');

  try {
    // Collect all unique products that are either on a watchlist OR have an active alert
    const [watchedUsers, alertedProductIds] = await Promise.all([
      User.find({ watchlist: { $exists: true, $not: { $size: 0 } } })
          .select('watchlist').lean(),
      Alert.distinct('productId', { isActive: true }),
    ]);

    const watchedIds  = watchedUsers.flatMap((u) => u.watchlist.map(String));
    const alertedIds  = alertedProductIds.map(String);
    const uniqueIds   = [...new Set([...watchedIds, ...alertedIds])];
    const products    = await Product.find({ _id: { $in: uniqueIds } });

    let updated = 0;

    await runInBatches(products, async (product) => {
      try {
        const keyword    = product.title.split(' ').slice(0, 4).join(' ');
        const rawResults = await searchAmazonProducts(keyword, 1);
        if (!rawResults.length) return;

        // Bug 7 fix: normalizeApiProduct is async — must be awaited.
        // Phase 4 fix: normalizeApiProduct returns null for malformed/zero-price items.
        // Guard before accessing .price to prevent silent TypeError crash.
        const usdRate = await getUsdToInrRate().catch(() => null);
        const normalized = await normalizeApiProduct(rawResults[0], 'Amazon', usdRate);
        if (!normalized) return; // Rejected by schema validator (no title or $0 price)
        const newPrice = normalized.price;
        if (!newPrice || newPrice <= 0) return;

        // Record the new price in history
        await PriceHistory.create({
          productId: product._id,
          platform:  'amazon',
          price:     newPrice,
          currency:  normalized.currency || 'INR',
        });

        // Update the live source price on the Product document
        const srcIdx = product.sources.findIndex((s) => s.platform === 'amazon');
        if (srcIdx >= 0) {
          product.sources[srcIdx].price       = newPrice;
          product.sources[srcIdx].lastUpdated = new Date();
          // Recalculate lowestPrice
          const prices      = product.sources.map((s) => s.price).filter((p) => p > 0);
          product.lowestPrice  = Math.min(...prices);
          product.highestPrice = Math.max(...prices);
          await product.save();
        }

        updated++;
      } catch (err) {
        logger.error(`[CronJob:PriceRefresh] Failed product ${product._id}: ${err.message}`);
      }
    }, BATCH_SIZE);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info(`[CronJob:PriceRefresh] Done. ${updated}/${products.length} updated in ${elapsed}s`);

  } catch (err) {
    logger.error(`[CronJob:PriceRefresh] Fatal error: ${err.message}`);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Job 2: Alert Evaluator
// ─────────────────────────────────────────────────────────────────────────────
const alertEvaluatorJob = async () => {
  const start = Date.now();
  logger.info('[CronJob:AlertEval] Evaluating active alerts...');

  try {
    // Only load alerts that are active, not in cooldown, and either untriggered
    // OR recurring (can re-trigger after cooldown expires)
    const now          = new Date();
    const activeAlerts = await Alert.find({ isActive: true })
      .populate('userId',    'email name notificationPrefs')
      .populate('productId', 'title sources lowestPrice imageUrl');

    let triggered = 0;
    let emailed   = 0;

    await runInBatches(activeAlerts, async (alert) => {
      try {
        if (!alert.productId || !alert.userId) return;

        // Mark as checked regardless of outcome (audit trail)
        alert.lastCheckedAt = now;

        // Skip if in cooldown
        if (alert.isInCooldown) {
          await Alert.updateOne({ _id: alert._id }, { lastCheckedAt: now });
          return;
        }

        // Determine which sources to check
        const sources = alert.platform === 'any'
          ? alert.productId.sources
          : alert.productId.sources.filter((s) => s.platform === alert.platform);

        if (!sources.length) return;

        // Find the cheapest source that meets the alert condition
        let bestMatch = null;
        let bestEval  = null;

        for (const source of sources) {
          const evaluation = alert.evaluatePrice(source.price);
          if (evaluation.triggered) {
            if (!bestMatch || source.price < bestMatch.price) {
              bestMatch = source;
              bestEval  = evaluation;
            }
          }
        }

        if (!bestMatch) {
          await Alert.updateOne({ _id: alert._id }, { lastCheckedAt: now });
          return;
        }

        // ── Trigger the alert ──────────────────────────────────────────────
        triggered++;
        const updateData = {
          triggered:         true,
          triggeredAt:       now,
          triggeredPrice:    bestMatch.price,
          triggeredPlatform: bestMatch.platform,
          triggerCount:      (alert.triggerCount || 0) + 1,
          notificationSent:  false,
          lastCheckedAt:     now,
        };
        await Alert.updateOne({ _id: alert._id }, updateData);

        // ── Send email notification ────────────────────────────────────────
        const user    = alert.userId;
        const product = alert.productId;
        const wantsEmail = user?.notificationPrefs?.email !== false &&
                           user?.notificationPrefs?.priceDrops !== false;

        if (wantsEmail && user.email) {
          const emailResult = await sendPriceDropAlert({
            to:           user.email,
            userName:     user.name,
            productTitle: product.title,
            targetPrice:  alert.targetPrice,
            currentPrice: bestMatch.price,
            platform:     bestMatch.platform,
            productLink:  bestMatch.link,
            savingsAmt:   bestEval.savingsAmt,
            savingsPct:   bestEval.savingsPct,
            triggerReason: bestEval.triggerReason,
          });

          if (emailResult.success) {
            await Alert.updateOne({ _id: alert._id }, {
              notificationSent:   true,
              notificationSentAt: now,
              // Deactivate one-shot alerts; keep recurring alerts active
              ...(alert.recurring ? {} : { isActive: false }),
            });
            emailed++;
          }
        }

      } catch (err) {
        logger.error(`[CronJob:AlertEval] Error alert ${alert._id}: ${err.message}`);
      }
    }, ALERT_BATCH);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info(`[CronJob:AlertEval] Done. Triggered=${triggered} Emailed=${emailed} in ${elapsed}s`);

  } catch (err) {
    logger.error(`[CronJob:AlertEval] Fatal error: ${err.message}`);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Job 3: Recurring Alert Rearm
// ─────────────────────────────────────────────────────────────────────────────
const alertRearmJob = async () => {
  logger.info('[CronJob:AlertRearm] Checking for expired cooldowns...');
  try {
    const now = new Date();

    // Find triggered recurring alerts whose cooldown has expired
    const eligibleAlerts = await Alert.find({
      isActive:  true,
      recurring: true,
      triggered: true,
      notificationSentAt: { $ne: null },
    }).populate('userId', 'email name')
      .populate('productId', 'title');

    let rearmed = 0;
    for (const alert of eligibleAlerts) {
      const cooldownMs = alert.cooldownHours * 60 * 60 * 1000;
      if (Date.now() - alert.notificationSentAt.getTime() >= cooldownMs) {
        await alert.rearm();
        rearmed++;
        // Optionally notify user that alert is watching again
        if (alert.userId?.email && alert.productId?.title) {
          await sendAlertRearmedEmail({
            to:           alert.userId.email,
            userName:     alert.userId.name,
            productTitle: alert.productId.title,
            targetPrice:  alert.targetPrice,
          }).catch(() => {});
        }
      }
    }
    logger.info(`[CronJob:AlertRearm] Re-armed ${rearmed} alert(s)`);
  } catch (err) {
    logger.error(`[CronJob:AlertRearm] Error: ${err.message}`);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Job 4: Weekly Digest
// ─────────────────────────────────────────────────────────────────────────────
const weeklyDigestJob = async () => {
  logger.info('[CronJob:WeeklyDigest] Sending weekly digests...');
  try {
    // Get users who have at least one active alert and want email digests
    const users = await User.find({
      'notificationPrefs.weeklyDigest': { $ne: false },
    }).select('email name watchlist').lean();

    let sent = 0;
    for (const user of users) {
      try {
        if (!user.email || !user.watchlist?.length) continue;

        const products = await Product.find({ _id: { $in: user.watchlist } })
          .select('title lowestPrice')
          .lean();

        if (!products.length) continue;

        const emailResult = await sendWeeklyDigest({
          to:       user.email,
          userName: user.name,
          products: products.map((p) => ({
            title:        p.title,
            currentPrice: p.lowestPrice,
            currency:     'INR',
          })),
        });

        if (emailResult.success) sent++;
      } catch (err) {
        logger.error(`[CronJob:WeeklyDigest] Failed for user ${user._id}: ${err.message}`);
      }
    }
    logger.info(`[CronJob:WeeklyDigest] Sent ${sent} digests`);
  } catch (err) {
    logger.error(`[CronJob:WeeklyDigest] Fatal: ${err.message}`);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Job 5: Data Cleanup
// ─────────────────────────────────────────────────────────────────────────────
const dataCleanupJob = async () => {
  logger.info('[CronJob:Cleanup] Starting data cleanup...');
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

    const [historyResult, alertResult] = await Promise.all([
      // Remove price history older than 90 days
      PriceHistory.deleteMany({ timestamp: { $lt: cutoff } }),
      // Remove triggered one-shot alerts older than 30 days
      Alert.deleteMany({
        recurring: false,
        triggered: true,
        triggeredAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    logger.info(
      `[CronJob:Cleanup] Removed ${historyResult.deletedCount} history records, ` +
      `${alertResult.deletedCount} old alerts`
    );
  } catch (err) {
    logger.error(`[CronJob:Cleanup] Error: ${err.message}`);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Initialize All Jobs
// ─────────────────────────────────────────────────────────────────────────────
const initCronJobs = () => {
  // Job 1 — Price refresh every 6h at :00
  cron.schedule('0 */6 * * *',       priceRefreshJob,  { timezone: 'UTC' });
  // Job 2 — Alert evaluation every 6h at :05 (after refresh)
  cron.schedule('5 */6 * * *',       alertEvaluatorJob,{ timezone: 'UTC' });
  // Job 3 — Recurring alert rearm every hour
  cron.schedule('30 * * * *',        alertRearmJob,    { timezone: 'UTC' });
  // Job 4 — Weekly digest every Sunday at 08:00 UTC
  cron.schedule('0 8 * * 0',         weeklyDigestJob,  { timezone: 'UTC' });
  // Job 5 — Data cleanup daily at 02:00 UTC
  cron.schedule('0 2 * * *',         dataCleanupJob,   { timezone: 'UTC' });

  logger.info('[CronJob] All 5 jobs scheduled: PriceRefresh, AlertEval, AlertRearm, WeeklyDigest, Cleanup');
};

module.exports = {
  initCronJobs,
  // Export individual jobs for manual triggers / testing
  priceRefreshJob,
  alertEvaluatorJob,
  alertRearmJob,
  weeklyDigestJob,
  dataCleanupJob,
};
