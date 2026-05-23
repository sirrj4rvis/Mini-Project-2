const axios = require('axios');
const logger = require('../config/logger');

// --- USD → INR ---------------------------------------------------------------
let _usdToInrRate = null;
let _usdLastFetch = 0;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const getUsdToInrRate = async () => {
  const now = Date.now();
  if (_usdToInrRate && (now - _usdLastFetch < CACHE_TTL)) {
    return _usdToInrRate;
  }
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 5000 });
    if (response.data?.rates?.INR) {
      _usdToInrRate = response.data.rates.INR;
      _usdLastFetch = now;
      logger.info(`[CurrencyService] Fetched live USD -> INR rate: ${_usdToInrRate}`);
      return _usdToInrRate;
    }
  } catch (error) {
    logger.warn(`[CurrencyService] Failed to fetch live exchange rate: ${error.message}`);
  }
  const fallbackRate = parseFloat(process.env.USD_TO_INR) || 83;
  logger.info(`[CurrencyService] Using fallback USD -> INR rate: ${fallbackRate}`);
  return fallbackRate;
};

/**
 * Convert an amount from one currency to INR.
 * Supports USD, GBP, EUR; passes through INR unchanged.
 * Bug 18 fix: Previously only USD→INR was handled. GBP/EUR from eBay international
 * listings were passed through unconverted, corrupting price comparisons.
 *
 * @returns {{ convertedAmount: number, exchangeRateUsed: number }}
 */
const convertCurrency = async (amount, fromCurrency, toCurrency = 'INR') => {
  if (!amount || isNaN(amount)) return { convertedAmount: 0, exchangeRateUsed: 1 };

  const from = (fromCurrency || 'INR').toUpperCase();
  const to   = toCurrency.toUpperCase();

  if (from === to) return { convertedAmount: amount, exchangeRateUsed: 1 };

  // USD → INR (live rate)
  if (from === 'USD' && to === 'INR') {
    const rate = await getUsdToInrRate();
    return { convertedAmount: Math.round(amount * rate), exchangeRateUsed: rate };
  }

  // GBP → INR (approx 1 GBP ≈ 106 INR; fallback if env not set)
  if (from === 'GBP' && to === 'INR') {
    const rate = parseFloat(process.env.GBP_TO_INR) || 106;
    logger.info(`[CurrencyService] Converting GBP → INR using rate: ${rate}`);
    return { convertedAmount: Math.round(amount * rate), exchangeRateUsed: rate };
  }

  // EUR → INR (approx 1 EUR ≈ 90 INR; fallback if env not set)
  if (from === 'EUR' && to === 'INR') {
    const rate = parseFloat(process.env.EUR_TO_INR) || 90;
    logger.info(`[CurrencyService] Converting EUR → INR using rate: ${rate}`);
    return { convertedAmount: Math.round(amount * rate), exchangeRateUsed: rate };
  }

  // Unknown currency — log and return as-is to prevent silent data corruption
  logger.warn(`[CurrencyService] Unsupported currency conversion: ${from} → ${to}. Returning original amount. Add ${from}_TO_INR to .env to fix.`);
  return { convertedAmount: amount, exchangeRateUsed: 1 };
};

module.exports = { getUsdToInrRate, convertCurrency };
