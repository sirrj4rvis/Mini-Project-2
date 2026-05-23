'use strict';

/**
 * mailerService.js — PriceLens Transactional Email System
 *
 * All emails are rendered from inline HTML templates styled to match the
 * PriceLens brand (dark ink, warm terracotta accent, Inter typography).
 *
 * Supported email types:
 *   sendPriceDropAlert()   — Triggered when price drops below user target
 *   sendPriceSurgeWarning()— Triggered when price is rising fast (buy now signal)
 *   sendWeeklyDigest()     — Weekly summary of watched products (cron)
 *   sendWelcomeEmail()     — On new user registration
 *   sendAlertRearmedEmail()— When a recurring alert re-activates after cooldown
 *
 * Delivery:
 *   Uses Gmail SMTP with an App Password. Falls back silently when credentials
 *   are not configured (development mode).
 */

const nodemailer = require('nodemailer');
const logger     = require('../config/logger');

// ── Configuration ─────────────────────────────────────────────────────────────
const BRAND_NAME  = 'PriceLens';
const BRAND_COLOR = '#c2410c'; // Terracotta accent
const BRAND_DARK  = '#1c1917'; // Deep ink

const emailConfigured = () => {
  const user = process.env.EMAIL_USER || '';
  const pass = process.env.EMAIL_PASS || '';
  return (
    user.length > 0 && pass.length > 0 &&
    !user.includes('your_gmail') && !pass.includes('your_gmail')
  );
};

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

// ── Shared Template Helpers ───────────────────────────────────────────────────
const formatPrice = (price, currency = 'INR') => {
  if (!price) return '—';
  const symbol = currency === 'INR' ? '₹' : '$';
  return `${symbol}${Number(price).toLocaleString('en-IN')}`;
};

const baseStyles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #f5f4f0; color: #1c1917; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 620px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: ${BRAND_DARK}; padding: 36px 40px; }
    .logo   { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .logo span { color: ${BRAND_COLOR}; }
    .hero   { padding: 40px 40px 24px; }
    .hero h1 { font-size: 26px; font-weight: 700; color: ${BRAND_DARK}; line-height: 1.3; }
    .hero p  { font-size: 15px; color: #57534e; margin-top: 10px; line-height: 1.6; }
    .price-card { margin: 24px 40px; border-radius: 12px; padding: 24px; border: 1px solid #e7e5e4; text-align: center; }
    .price-card.drop { background: #f0fdf4; border-color: #86efac; }
    .price-card.surge { background: #fff7ed; border-color: #fca5a5; }
    .price-now { font-size: 40px; font-weight: 700; color: #15803d; }
    .price-now.surge { color: #b45309; }
    .price-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #78716c; margin-bottom: 6px; }
    .price-target { font-size: 14px; color: #78716c; margin-top: 8px; }
    .savings-badge { display: inline-block; background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; margin-top: 12px; }
    .savings-badge.surge { background: #fee2e2; color: #b91c1c; }
    .details { padding: 0 40px 24px; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f4f4f4; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #78716c; }
    .detail-value { font-weight: 600; color: ${BRAND_DARK}; }
    .cta-wrap { padding: 8px 40px 36px; text-align: center; }
    .cta-btn { display: inline-block; background: ${BRAND_DARK}; color: #fff; padding: 14px 36px; border-radius: 99px; text-decoration: none; font-weight: 600; font-size: 15px; letter-spacing: -0.2px; }
    .cta-btn:hover { background: #292524; }
    .footer { padding: 24px 40px; background: #fafaf9; border-top: 1px solid #e7e5e4; text-align: center; font-size: 12px; color: #a8a29e; line-height: 1.8; }
    .unsubscribe { color: #a8a29e; text-decoration: underline; }
    @media (max-width: 640px) {
      .hero, .details, .cta-wrap, .footer { padding-left: 24px; padding-right: 24px; }
      .price-card { margin: 24px; }
    }
  </style>
`;

const emailShell = (content) => `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${baseStyles}</head>
  <body>
    <div class="wrapper">
      <div class="header">
        <div class="logo">Price<span>Lens</span></div>
      </div>
      ${content}
      <div class="footer">
        <p>You received this email because you set up price alerts on ${BRAND_NAME}.</p>
        <p style="margin-top:6px"><a class="unsubscribe" href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alerts">Manage your alerts</a></p>
        <p style="margin-top:12px">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
`;

// ── Email Senders ─────────────────────────────────────────────────────────────

/**
 * Price Drop Alert — the core notification email.
 * Sent when a product's price falls to/below the user's target.
 */
const sendPriceDropAlert = async ({
  to, userName, productTitle, targetPrice,
  currentPrice, platform, productLink,
  savingsAmt = 0, savingsPct = 0, triggerReason = '',
  currency = 'INR',
}) => {
  if (!emailConfigured()) {
    logger.warn('[Mailer] Credentials not set — skipping price drop email');
    return { success: false, error: 'Email not configured' };
  }
  try {
    const transporter = createTransporter();

    const html = emailShell(`
      <div class="hero">
        <h1>Price drop detected!</h1>
        <p>Hi <strong>${userName}</strong>, your target price has been reached for a product you're watching on <strong>${platform}</strong>.</p>
      </div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Product</span>
          <span class="detail-value" style="max-width:55%;text-align:right">${productTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Platform</span>
          <span class="detail-value">${platform}</span>
        </div>
      </div>

      <div class="price-card drop">
        <div class="price-label">Current Price</div>
        <div class="price-now">${formatPrice(currentPrice, currency)}</div>
        <div class="price-target">Your target: ${formatPrice(targetPrice, currency)}</div>
        ${savingsAmt > 0
          ? `<div class="savings-badge">You save ${formatPrice(savingsAmt, currency)} (${savingsPct.toFixed(1)}%)</div>`
          : ''}
      </div>

      <p style="padding: 0 40px 20px; font-size:14px; color:#57534e">
        ${triggerReason || 'Prices can rise again at any time. Act fast!'}
      </p>

      <div class="cta-wrap">
        <a href="${productLink || process.env.CLIENT_URL}" class="cta-btn">Buy Now on ${platform}</a>
      </div>
    `);

    const info = await transporter.sendMail({
      from:    `"${BRAND_NAME} Alerts" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Price Drop: ${productTitle} is now ${formatPrice(currentPrice, currency)}`,
      html,
    });
    logger.info(`[Mailer] Price drop email sent → ${to}  msgId=${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    logger.error(`[Mailer] sendPriceDropAlert failed for ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
};


/**
 * Price Surge Warning — buy before it gets more expensive.
 */
const sendPriceSurgeWarning = async ({
  to, userName, productTitle, currentPrice, predictedPrice,
  platform, productLink, currency = 'INR',
}) => {
  if (!emailConfigured()) return { success: false, error: 'Email not configured' };
  try {
    const transporter = createTransporter();
    const risePct = predictedPrice && currentPrice
      ? (((predictedPrice - currentPrice) / currentPrice) * 100).toFixed(1)
      : null;

    const html = emailShell(`
      <div class="hero">
        <h1>Price rising soon — buy now?</h1>
        <p>Hi <strong>${userName}</strong>, our ML model predicts that the price of a product you're watching may increase soon.</p>
      </div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Product</span>
          <span class="detail-value" style="max-width:55%;text-align:right">${productTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Platform</span>
          <span class="detail-value">${platform}</span>
        </div>
      </div>

      <div class="price-card surge">
        <div class="price-label">Current Price</div>
        <div class="price-now surge">${formatPrice(currentPrice, currency)}</div>
        ${predictedPrice ? `<div class="price-target">Predicted in 7 days: ${formatPrice(predictedPrice, currency)}</div>` : ''}
        ${risePct ? `<div class="savings-badge surge">May rise by ~${risePct}%</div>` : ''}
      </div>

      <div class="cta-wrap">
        <a href="${productLink || process.env.CLIENT_URL}" class="cta-btn">Lock in current price</a>
      </div>
    `);

    const info = await transporter.sendMail({
      from:    `"${BRAND_NAME} Alerts" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Heads up: ${productTitle} price may rise soon`,
      html,
    });
    logger.info(`[Mailer] Surge warning sent → ${to}`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    logger.error(`[Mailer] sendPriceSurgeWarning failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};


/**
 * Weekly Digest — summary of watched products sent every Sunday.
 */
const sendWeeklyDigest = async ({ to, userName, products = [] }) => {
  if (!emailConfigured() || products.length === 0) return { success: false };
  try {
    const transporter = createTransporter();

    const rows = products.map((p) => `
      <div class="detail-row">
        <span class="detail-label" style="max-width:60%">${p.title}</span>
        <span class="detail-value">${formatPrice(p.currentPrice, p.currency)}</span>
      </div>
    `).join('');

    const html = emailShell(`
      <div class="hero">
        <h1>Your weekly price digest</h1>
        <p>Hi <strong>${userName}</strong>, here's a summary of the products you're watching this week.</p>
      </div>
      <div class="details">${rows}</div>
      <div class="cta-wrap">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alerts" class="cta-btn">View all alerts</a>
      </div>
    `);

    const info = await transporter.sendMail({
      from:    `"${BRAND_NAME}" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Your ${BRAND_NAME} Weekly Price Report`,
      html,
    });
    logger.info(`[Mailer] Weekly digest sent → ${to}`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    logger.error(`[Mailer] sendWeeklyDigest failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};


/**
 * Welcome Email — sent after new user registration.
 */
const sendWelcomeEmail = async ({ to, userName }) => {
  if (!emailConfigured()) {
    logger.warn('[Mailer] Credentials not set — skipping welcome email');
    return;
  }
  try {
    const transporter = createTransporter();

    const html = emailShell(`
      <div class="hero">
        <h1>Welcome to ${BRAND_NAME}, ${userName}!</h1>
        <p>Your account is ready. Here's what you can do:</p>
      </div>
      <div class="details">
        <div class="detail-row"><span class="detail-label">Search & Compare</span><span class="detail-value">200+ stores</span></div>
        <div class="detail-row"><span class="detail-label">Price History</span><span class="detail-value">60-day charts</span></div>
        <div class="detail-row"><span class="detail-label">Price Alerts</span><span class="detail-value">Email notifications</span></div>
        <div class="detail-row"><span class="detail-label">ML Predictions</span><span class="detail-value">7-day forecasts</span></div>
      </div>
      <div class="cta-wrap">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" class="cta-btn">Start Saving</a>
      </div>
    `);

    await transporter.sendMail({
      from:    `"${BRAND_NAME}" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Welcome to ${BRAND_NAME} — Never Pay Full Price Again`,
      html,
    });
    logger.info(`[Mailer] Welcome email sent → ${to}`);

  } catch (err) {
    logger.error(`[Mailer] sendWelcomeEmail failed: ${err.message}`);
  }
};


/**
 * Alert Re-Armed — notifies user that their recurring alert is active again.
 */
const sendAlertRearmedEmail = async ({ to, userName, productTitle, targetPrice, currency = 'INR' }) => {
  if (!emailConfigured()) return;
  try {
    const transporter = createTransporter();
    const html = emailShell(`
      <div class="hero">
        <h1>Your alert is active again</h1>
        <p>Hi <strong>${userName}</strong>, your price alert for <strong>${productTitle}</strong> has re-activated after its cooldown period. We'll notify you if the price drops to ${formatPrice(targetPrice, currency)} again.</p>
      </div>
      <div class="cta-wrap">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alerts" class="cta-btn">Manage Alerts</a>
      </div>
    `);
    await transporter.sendMail({
      from:    `"${BRAND_NAME}" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Alert Re-Armed: ${productTitle}`,
      html,
    });
  } catch (err) {
    logger.error(`[Mailer] sendAlertRearmedEmail failed: ${err.message}`);
  }
};

module.exports = {
  sendPriceDropAlert,
  sendPriceSurgeWarning,
  sendWeeklyDigest,
  sendWelcomeEmail,
  sendAlertRearmedEmail,
};
