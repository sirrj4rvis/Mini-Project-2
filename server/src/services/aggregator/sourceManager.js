const FlipkartScraper = require('../scrapers/flipkart/flipkart.scraper');
const MyntraScraper = require('../scrapers/myntra/myntra.scraper');
const CromaScraper = require('../scrapers/croma/croma.scraper');
const RelianceScraper = require('../scrapers/reliance/reliance.scraper');

// Try to safely load the API services
let amazonApi, ebayApi, walmartApi;
try { amazonApi = require('../amazonApiService'); } catch (e) { amazonApi = null; }
try { ebayApi = require('../ebayApiService'); } catch (e) { ebayApi = null; }
try { walmartApi = require('../walmartApiService'); } catch (e) { walmartApi = null; }

const DelayManager = require('../antiblock/delayManager');
const RateLimiter = require('../antiblock/rateLimiter');
const RetryStrategy = require('../antiblock/retryStrategy');
const { convertCurrency, getUsdToInrRate } = require('../currencyService');

// Instantiate scrapers
const scrapers = {
  flipkart: new FlipkartScraper(),
  myntra: new MyntraScraper(),
  croma: new CromaScraper(),
  reliance: new RelianceScraper()
};

/**
 * Adapts raw API outputs into the Unified Product Schema required by the frontend.
 * This ensures scrapers and APIs speak the exact same language.
 *
 * @param {Object} rawProduct
 * @param {string} sourceName
 * @param {number|null} preloadedRateINR - Pre-fetched USD→INR rate (avoids N concurrent fetches)
 */
async function normalizeApiProduct(rawProduct, sourceName, preloadedRateINR = null) {
  if (!rawProduct) return null;
  
  // Coalesce various API price fields
  const rawPrice = rawProduct.price?.value || rawProduct.price || rawProduct.product_price || rawProduct.salePrice || 0;
  const title = rawProduct.title || rawProduct.product_title || rawProduct.name || '';
  
  // Walmart uses onlineAvailability boolean
  const isAvailable = rawProduct.availability === 'In stock' 
    || rawProduct.onlineAvailability !== false 
    || rawProduct.availability === 'AVAILABLE';

  let link = rawProduct.link || rawProduct.itemWebUrl || rawProduct.product_url || rawProduct.canonicalUrl || rawProduct.url || '';
  
  // Strip tracking parameters to enforce canonical database URLs
  if (sourceName === 'Walmart' || sourceName === 'eBay') {
    link = link.split('?')[0];
  }
  
  // Inject Amazon Affiliate Tag
  if (sourceName === 'Amazon' && link) {
    try {
      const urlObj = new URL(link);
      urlObj.searchParams.set('tag', process.env.AMAZON_AFFILIATE_ID || 'pricelens01-21');
      link = urlObj.toString();
    } catch (e) {
      if (link.includes('?')) link += '&tag=' + (process.env.AMAZON_AFFILIATE_ID || 'pricelens01-21');
      else link += '?tag=' + (process.env.AMAZON_AFFILIATE_ID || 'pricelens01-21');
    }
  }

  // Detect source currency
  const detectedCurrency = rawProduct.price?.currency || rawProduct.currency || (sourceName === 'Walmart' ? 'USD' : 'INR');
  
  // Bug 6 fix: Use pre-fetched rate when provided to avoid N concurrent exchange rate fetches.
  // If rate is not pre-fetched (e.g. called individually), fall back to convertCurrency normally.
  let convertedAmount;
  if (preloadedRateINR && detectedCurrency === 'USD') {
    convertedAmount = Math.round(parseFloat(rawPrice) * preloadedRateINR);
  } else {
    const result = await convertCurrency(parseFloat(rawPrice), detectedCurrency, 'INR');
    convertedAmount = result.convertedAmount;
  }

  // Safely resolve nested image objects (specifically for eBay Browse API)
  let imageStr = rawProduct.image?.imageUrl || rawProduct.image || rawProduct.imageUrl || rawProduct.product_photo || '';
  if (typeof imageStr === 'object' && imageStr !== null) {
    imageStr = imageStr.imageUrl || imageStr.url || '';
  }

  // Force absolute protocol for images
  if (typeof imageStr === 'string') {
    if (imageStr.startsWith('//')) {
      imageStr = 'https:' + imageStr;
    }
  }

  // STRICT SCHEMA VALIDATION
  // Reject products missing a title or having a $0 price (malformed data)
  if (!title || convertedAmount <= 0) {
    return null;
  }

  return {
    title: title,
    normalizedTitle: title.trim().toLowerCase().replace(/\s+/g, ' '),
    price: convertedAmount,
    currency: 'INR',
    image: typeof imageStr === 'string' ? imageStr : '',
    rating: parseFloat(rawProduct.rating || rawProduct.product_rating || rawProduct.customerReviewAverage || 0),
    reviewCount: parseInt(rawProduct.reviewCount || rawProduct.product_num_reviews || rawProduct.customerReviewCount || rawProduct.reviews || 0, 10),
    source: sourceName,
    category: rawProduct.category || rawProduct.categoryPath?.[0]?.name || 'General',
    availability: isAvailable ? 'In Stock' : 'Out of Stock',
    link: link,
    timestamp: new Date().toISOString()
  };
}

/**
 * Returns a list of standardized search tasks for all active sources.
 * Encapsulates the execution logic so the parallel runner doesn't care if it's an API or Scraper.
 */
function getActiveSources(query) {
  const sources = [];

  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_LIVE_SCRAPERS_IN_TEST === 'true') {
    sources.push(
      {
        name: 'Flipkart',
        type: 'scraper',
        execute: () => scrapers.flipkart.search(query)
      },
      {
        name: 'Myntra',
        type: 'scraper',
        execute: () => scrapers.myntra.search(query)
      },
      {
        name: 'Croma',
        type: 'scraper',
        execute: () => scrapers.croma.search(query)
      },
      {
        name: 'Reliance Digital',
        type: 'scraper',
        execute: () => scrapers.reliance.search(query)
      }
    );
  }

  // Dynamically attach Amazon API if available
  if (amazonApi && amazonApi.searchAmazonProducts) {
    sources.push({
      name: 'Amazon',
      type: 'api',
      execute: async () => {
        return await RetryStrategy.execute(async () => {
          await RateLimiter.throttle('amazon-api', 1000);
          const results = await amazonApi.searchAmazonProducts(query);
          // Bug 6 fix: Pre-fetch rate once — avoids N concurrent exchange rate API calls
          const usdRate = await getUsdToInrRate().catch(() => null);
          const normalized = await Promise.all((results || []).map(item => normalizeApiProduct(item, 'Amazon', usdRate)));
          return normalized.filter(i => i !== null);
        }, { context: 'Amazon API', maxRetries: 2, baseDelayMs: 1500 });
      }
    });
  }

  // Dynamically attach eBay API if available
  if (ebayApi && ebayApi.searchEbayProducts) {
    sources.push({
      name: 'eBay',
      type: 'api',
      execute: async () => {
        return await RetryStrategy.execute(async () => {
          await RateLimiter.throttle('ebay-api', 1000);
          const results = await ebayApi.searchEbayProducts(query);
          // Bug 6 fix: Pre-fetch rate once
          const usdRate = await getUsdToInrRate().catch(() => null);
          const normalized = await Promise.all((results || []).map(item => normalizeApiProduct(item, 'eBay', usdRate)));
          return normalized.filter(i => i !== null);
        }, { context: 'eBay API', maxRetries: 2, baseDelayMs: 1500 });
      }
    });
  }

  // Dynamically attach Walmart API if available
  if (walmartApi && walmartApi.searchWalmartProducts) {
    sources.push({
      name: 'Walmart',
      type: 'api',
      execute: async () => {
        return await RetryStrategy.execute(async () => {
          await RateLimiter.throttle('walmart-api', 1000);
          const results = await walmartApi.searchWalmartProducts(query);
          // Bug 6 fix: Walmart prices are in USD — pre-fetch rate once
          const usdRate = await getUsdToInrRate().catch(() => null);
          const normalized = await Promise.all((results || []).map(item => normalizeApiProduct(item, 'Walmart', usdRate)));
          return normalized.filter(i => i !== null);
        }, { context: 'Walmart API', maxRetries: 2, baseDelayMs: 1500 });
      }
    });
  }

  return sources;
}

module.exports = { getActiveSources, normalizeApiProduct };
