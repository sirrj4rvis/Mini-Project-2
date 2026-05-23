const axios = require('axios');
const logger = require('../config/logger');
const RetryStrategy = require('./antiblock/retryStrategy');
const { getFallbackData } = require('./api/fallbackData');

/**
 * eBay Browse API Service — India Marketplace (EBAY-IN)
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses the official eBay Browse API (OAuth2 Application Token).
 *
 * Setup:
 *  1. Go to https://developer.ebay.com → Create App
 *  2. Add EBAY_APP_ID and EBAY_CERT_ID to server/.env
 *  3. Set EBAY_MARKETPLACE_ID=EBAY-IN
 *
 * Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
 */

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || 'EBAY-IN';
const IS_SANDBOX = process.env.EBAY_ENVIRONMENT === 'SANDBOX';

const EBAY_AUTH_URL = IS_SANDBOX
  ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
  : 'https://api.ebay.com/identity/v1/oauth2/token';

const EBAY_API_BASE = IS_SANDBOX
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';

// In-process token cache — reuse until 5 min before expiry
let _cachedToken = null;
let _tokenExpiry = null;
// PERF FIX: Store the in-flight token fetch promise to prevent a "thundering herd".
// Without this, 5 concurrent cold-start requests all see _cachedToken===null and fire
// 5 separate OAuth requests to eBay simultaneously, wasting quota and increasing latency.
let _tokenFetchInFlight = null;

/**
 * Get or refresh the eBay OAuth2 Application Token.
 * Application tokens do NOT require user login — they use App ID + Cert ID.
 */
const getEbayToken = async () => {
  const now = Date.now();

  // Return cached token if still valid (with 5-min buffer)
  if (_cachedToken && _tokenExpiry && now < _tokenExpiry - 300_000) {
    return _cachedToken;
  }

  // Deduplicate: if a token fetch is already in flight, wait for it instead of
  // launching a duplicate request (prevents thundering herd on cold start)
  if (_tokenFetchInFlight) {
    return _tokenFetchInFlight;
  }

  if (!EBAY_APP_ID || !EBAY_CERT_ID || EBAY_APP_ID === 'your_ebay_app_id_here') {
    logger.warn('[eBayAPI] eBay credentials not configured — skipping eBay fetch');
    return null;
  }

  _tokenFetchInFlight = (async () => {
    try {
      const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');
      const response = await RetryStrategy.execute(() => axios.post(
        EBAY_AUTH_URL,
        'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      ), { context: 'eBay Token Fetch', maxRetries: 3 });

      _cachedToken = response.data.access_token;
      _tokenExpiry = now + response.data.expires_in * 1000;
      logger.info('[eBayAPI] Token obtained successfully');
      return _cachedToken;
    } catch (err) {
      logger.error(`[eBayAPI] Token fetch failed: ${err.response?.data?.error_description || err.message}`);
      return null;
    } finally {
      // Release the in-flight lock so future calls can refresh on next expiry
      _tokenFetchInFlight = null;
    }
  })();

  return _tokenFetchInFlight;
};

/**
 * Create an authenticated eBay API axios instance.
 */
const createEbayClient = async () => {
  const token = await getEbayToken();
  if (!token) return null;

  // eBay Partner Network (EPN) Campaign ID for Affiliate Commissions
  const affiliateCampaignId = process.env.EBAY_AFFILIATE_ID || '5338123456'; 

  const client = axios.create({
    baseURL: EBAY_API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_ID,
      'X-EBAY-C-ENDUSERCTX': `affiliateCampaignId=${affiliateCampaignId}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  // Seamless Token Refresh Interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        logger.warn('[eBayAPI] 401 Unauthorized - Token expired mid-flight. Refreshing...');
        _cachedToken = null; // Purge dead token
        const newToken = await getEbayToken();
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return client(originalRequest); // replay
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

/**
 * Search eBay products.
 * @param {string} query - Search term
 * @param {number} limit - Number of results (max 200)
 * @param {number} page  - Page number (1-based)
 * @returns {Array} Raw eBay item summaries
 */
const searchEbayProducts = async (query, limit = 10, page = 1) => {
  try {
    const client = await createEbayClient();
    if (!client) throw new Error('eBay client creation failed');

    let offset = (page - 1) * limit;
    // eBay limits offset to a maximum of 10,000
    if (offset > 10000) offset = 10000;

    logger.info(`[eBayAPI] Searching: "${query}" on ${MARKETPLACE_ID} | Page: ${page} | Limit: ${limit}`);
    
    const response = await RetryStrategy.execute(() => client.get('/buy/browse/v1/item_summary/search', {
      params: {
        q: query,
        limit,
        offset,
        filter: 'buyingOptions:{FIXED_PRICE}', // Only "Buy It Now" items
        sort: 'newlyListed',
      },
    }), { context: 'eBay Search API', maxRetries: 2 });

    const items = response.data?.itemSummaries || [];
    logger.info(`[eBayAPI] Found ${items.length} items for "${query}"`);
    
    // Inject Mock Fallback if in Sandbox and no live items found
    if (items.length === 0 && IS_SANDBOX) {
       logger.warn(`[eBayAPI] Sandbox returned 0 items. Injecting fallback mock data for "${query}".`);
       return getFallbackData('ebay', query) || [];
    }

    return items;
  } catch (err) {
    throw err;
  }
};

/**
 * Get full eBay item details by item ID.
 * @param {string} itemId - eBay item ID (e.g., "v1|123456789|0")
 */
const getEbayItemById = async (itemId) => {
  try {
    const client = await createEbayClient();
    if (!client) throw new Error('eBay client creation failed');

    logger.info(`[eBayAPI] Fetching item: ${itemId}`);
    const response = await RetryStrategy.execute(() => client.get(`/buy/browse/v1/item/${itemId}`), {
      context: `eBay Item Fetch ${itemId}`,
      maxRetries: 2
    });
    return response.data || null;
  } catch (err) {
    if (err.response?.status === 401) {
      _cachedToken = null;
      logger.warn('[eBayAPI] 401 Unauthorized - Purged dead token.');
    }
    throw err;
  }
};

module.exports = { searchEbayProducts, getEbayItemById };
