const Product = require('../models/Product');
const PriceHistory = require('../models/PriceHistory');
const SearchHistory = require('../models/SearchHistory');
const { aggregateSearch } = require('../services/aggregator/aggregator');
const { getWalmartRollbacks } = require('../services/walmartApiService');
const { getPricePrediction, getRecommendation } = require('../services/mlBridgeService');
const CacheManager = require('../services/cache/cacheManager');
const logger = require('../config/logger');

const toUnifiedResponse = (dbProduct) => ({
  id: dbProduct._id,
  title: dbProduct.title,
  price: dbProduct.lowestPrice,
  image: dbProduct.imageUrl,
  rating: dbProduct.sources?.[0]?.rating || 0,
  source: dbProduct.bestDealPlatform,
  link: dbProduct.sources?.find((s) => s.platform === dbProduct.bestDealPlatform)?.link || '#',
  originalPrice: dbProduct.highestPrice,
  discount: dbProduct.lowestPrice > 0 && dbProduct.highestPrice > dbProduct.lowestPrice
    ? Math.round(((dbProduct.highestPrice - dbProduct.lowestPrice) / dbProduct.highestPrice) * 100)
    : 0,
  currency: 'INR',
  availability: dbProduct.sources?.[0]?.availability || 'in_stock',
  brand: dbProduct.brand,
  category: dbProduct.category,
  storeCount: dbProduct.sources?.length || 0,
  originalCurrency: dbProduct.sources?.[0]?.originalCurrency,
  originalCurrencyPrice: dbProduct.sources?.[0]?.originalCurrencyPrice,
  seller: dbProduct.sources?.[0]?.seller,
});

const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || 'IN';

const normalizePlatform = (sourceName = '') => {
  const platform = String(sourceName).toLowerCase();
  if (platform.includes('amazon')) return 'amazon';
  if (platform.includes('flipkart')) return 'flipkart';
  if (platform.includes('ebay')) return 'ebay';
  if (platform.includes('walmart')) return 'walmart';
  return 'other';
};

const normalizeAvailability = (availability = '') => {
  const value = String(availability).toLowerCase();
  if (value.includes('out') || value.includes('unavailable')) return 'out_of_stock';
  if (value.includes('limited') || value.includes('few')) return 'limited';
  return 'in_stock';
};

const normalizeSourcesForDb = (product) => {
  const rawSources = product.sources?.length
    ? product.sources
    : [{
        name: product.source,
        platform: product.platform,
        price: product.price,
        originalPrice: product.originalPrice,
        currency: product.currency,
        link: product.link,
        availability: product.availability,
        rating: product.rating,
        reviewCount: product.reviewCount,
        seller: product.seller,
      }];

  return rawSources
    .map((source) => {
      const price = Number(source.price || 0);
      if (!price || price < 0) return null;

      return {
        platform: source.platform || normalizePlatform(source.name || product.source),
        price,
        currency: source.currency || product.currency || 'INR',
        originalPrice: Number(source.originalPrice || source.price || price),
        discount: Number(source.discount || 0),
        link: source.link || product.link || '#',
        availability: normalizeAvailability(source.availability || product.availability),
        rating: source.rating ?? product.rating ?? null,
        reviewCount: Number(source.reviewCount || product.reviewCount || 0),
        seller: source.seller || source.name || product.source || '',
        lastUpdated: new Date(),
      };
    })
    .filter(Boolean);
};

// ─── Helper: Upsert a single normalized product into DB ───────────────────────
const upsertProduct = async (p) => {
  try {
    const sources = normalizeSourcesForDb(p);
    if (!sources.length) return null;

    const normalizedTitle = (p.normalizedTitle || p.title).toLowerCase().trim();
    const prices = sources.map((s) => s.price).filter((n) => n > 0);
    const lowestPrice = prices.length ? Math.min(...prices) : 0;
    const highestPrice = prices.length ? Math.max(...prices) : 0;
    const averagePrice = prices.length
      ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
      : 0;
    const bestSource = sources.reduce(
      (prev, curr) => (prev.price < curr.price ? prev : curr),
      sources[0]
    );

    const doc = await Product.findOneAndUpdate(
      { normalizedTitle },
      {
        $set: {
          title: p.title,
          normalizedTitle,
          brand: p.brand || '',
          imageUrl: p.imageUrl || p.image || '',
          category: p.category || 'General',
          description: p.description || '',
          asin: p.asin || undefined,
          sources,
          searchKeywords: p.searchKeywords || [p.title?.toLowerCase()].filter(Boolean),
          lowestPrice,
          highestPrice,
          averagePrice,
          bestDealPlatform: bestSource.platform || '',
          lastScrapedAt: new Date(),
        },
        $inc: { searchCount: 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // ── Append to PriceHistory for each source ──────────────────────────────
    const historyOps = sources
      .filter((s) => s.price > 0)
      .map((s) => ({
        productId: doc._id,
        platform: s.platform,
        price: s.price,
        originalPrice: s.originalPrice,
        currency: s.currency,
        availability: s.availability,
      }));

    if (historyOps.length) {
      await PriceHistory.insertMany(historyOps, { ordered: false });
    }

    return doc;
  } catch (err) {
    logger.error(`[ProductController] Upsert failed: ${err.message}`);
    return null;
  }
};

// ─── 1. Search Products ───────────────────────────────────────────────────────
// GET /api/products/search?q=laptop&page=1&sort=price_asc&category=Electronics
//                         &minPrice=500&maxPrice=50000&platform=amazon
const searchProducts = async (req, res, next) => {
  try {
    const {
      q: query,
      page = 1,
      limit = 20,
      sort = 'relevance',
      category,
      minPrice,
      maxPrice,
      platform,
    } = req.query;

    logger.info(`[SearchController] Request for "${query}" | sort=${sort} cat=${category} price=${minPrice}-${maxPrice}`);

    // ── Execute the Advanced Aggregation Pipeline ──
    // This handles parallel fetching, deduplication, caching, and ranking internally
    const aggregationResult = await aggregateSearch(query);
    
    let validProducts = aggregationResult.results || [];

    // ── Apply Client-Side Filters ──────────────────────────────────────────
    if (category) {
      validProducts = validProducts.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase()
      );
    }
    if (minPrice !== undefined) {
      validProducts = validProducts.filter((p) => p.price >= parseFloat(minPrice));
    }
    if (maxPrice !== undefined) {
      validProducts = validProducts.filter((p) => p.price <= parseFloat(maxPrice));
    }
    if (platform && platform !== 'any') {
      validProducts = validProducts.filter((p) =>
        p.sources?.some((s) =>
          (s.platform || normalizePlatform(s.name)).toLowerCase() === platform.toLowerCase()
        )
      );
    }

    // ── Apply Client-Side Sorting (Overrides Engine Ranking) ────────────────
    const sortMap = {
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      relevance: null, // Keeps the advanced ranking engine's order
    };
    if (sortMap[sort]) validProducts.sort(sortMap[sort]);

    // ── Pagination ──────────────────────────────────────────────────────────
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = validProducts.slice(startIndex, endIndex);

    // ── Log to SearchHistory (non-blocking) ─────────────────────────────────
    SearchHistory.create({
      userId: req.user?._id || null,
      sessionId: req.headers['x-session-id'] || null,
      query,
      resultCount: validProducts.length,
      appliedFilters: { category, priceMin: minPrice, priceMax: maxPrice, platform },
      source: 'web',
      ipAddress: req.ip,
    }).catch(() => {}); // Fire and forget

    // ── Ensure Products exist in DB and have _ids ───────────────────────────
    const savedProducts = await Promise.all(
      paginatedProducts.map(async (p) => {
        if (p.image && !p.imageUrl) p.imageUrl = p.image; // align schema
        const doc = await upsertProduct(p);
        if (doc) {
          // Attach the MongoDB _id to the raw aggregator response
          return { ...p, _id: doc._id.toString(), id: doc._id.toString() };
        }
        return p;
      })
    );

    // ── Build response using unified format ─────────────────────────────────
    const response = {
      success: true,
      query,
      count: validProducts.length,
      page: parseInt(page),
      totalPages: Math.ceil(validProducts.length / parseInt(limit)),
      executionTimeMs: aggregationResult.executionTimeMs,
      dataSource: aggregationResult.source, // 'Cache' or 'Live'
      products: savedProducts, // Products now have real MongoDB _ids
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ─── 2. Get Single Product Details ───────────────────────────────────────────
// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = CacheManager.productKey(id);
    const cached = CacheManager.get(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const response = { success: true, product };
    CacheManager.set(cacheKey, response, parseInt(process.env.CACHE_TTL_PRODUCT, 10) || 600);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ─── 2.5 Live Amazon Reviews ───────────────────────────────────────────────
// GET /api/products/:id/amazon-reviews
const getAmazonReviews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cacheKey = `amazon-reviews-${id}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return res.json({ success: true, reviews: cached, fromCache: true });

    const product = await Product.findById(id).lean();
    if (!product || !product.asin) {
      return res.status(404).json({ success: false, message: 'No Amazon ASIN found for this product.' });
    }

    const { getProductReviews } = require('../services/amazonApiService');
    const reviews = await getProductReviews(product.asin, 'IN');
    
    // Cache for 24 hours (86400 seconds) since reviews don't change by the minute
    CacheManager.set(cacheKey, reviews, 86400); 
    
    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
};

// ─── 3. Price History ────────────────────────────────────────────────────────
// GET /api/products/:id/history?days=30&platform=amazon
const getPriceHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = req.query.days ? parseInt(req.query.days, 10) : 30;
    const platform = req.query.platform ? String(req.query.platform) : undefined;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));

    const query = { productId: id, timestamp: { $gte: since } };
    if (platform && platform !== 'all') query.platform = platform;

    const history = await PriceHistory.find(query)
      .sort({ timestamp: 1 })
      .select('price platform timestamp currency availability -_id')
      .lean();

    // Group by platform for charting
    const byPlatform = history.reduce((acc, entry) => {
      const key = entry.platform;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        date: entry.timestamp.toISOString().split('T')[0],
        price: entry.price,
      });
      return acc;
    }, {});

    // Flat array for ML-style consumption
    const flat = history.map((h) => ({
      date: h.timestamp.toISOString().split('T')[0],
      price: h.price,
      platform: h.platform,
    }));

    res.json({
      success: true,
      productId: id,
      days,
      totalPoints: history.length,
      byPlatform,
      flat,
    });
  } catch (err) {
    next(err);
  }
};

// ─── 4. Compare Across Platforms ─────────────────────────────────────────────
// GET /api/products/:id/compare
const compareProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const comparison = product.sources
      .map((s) => ({
        platform: s.platform,
        price: s.price,
        originalPrice: s.originalPrice,
        discount: s.discount,
        currency: s.currency,
        rating: s.rating,
        reviewCount: s.reviewCount,
        availability: s.availability,
        link: s.link,
        seller: s.seller,
        lastUpdated: s.lastUpdated,
        savings: product.highestPrice - s.price, // How much cheaper vs most expensive
      }))
      .sort((a, b) => a.price - b.price);

    res.json({
      success: true,
      productTitle: product.title,
      currentBestPrice: comparison[0]?.price || 0,
      bestDeal: comparison[0],
      comparison,
    });
  } catch (err) {
    next(err);
  }
};

// ─── 5. ML Price Prediction ───────────────────────────────────────────────────
// GET /api/products/:id/predict?days=7
const getPrediction = async (req, res, next) => {
  try {
    const { id }  = req.params;
    const daysAhead = Math.min(parseInt(req.query.days, 10) || 7, 30);

    // ── Fetch product + price history in parallel ──────────────────────────
    const [product, historyDocs] = await Promise.all([
      Product.findById(id).lean(),
      PriceHistory.find({ productId: id })
        .sort({ timestamp: 1 })
        .select('price platform timestamp currency -_id')
        .lean(),
    ]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // ── Determine best platform & MRP for ML context ───────────────────────
    const bestSource = (product.sources || []).reduce(
      (prev, curr) => (curr.price > 0 && curr.price < (prev.price || Infinity) ? curr : prev),
      {}
    );
    const productMeta = {
      category:    product.category     || 'Electronics',
      platform:    bestSource.platform  || 'Amazon',
      mrp:         product.highestPrice || null,
      rating:      bestSource.rating    || 4.0,
      reviewCount: bestSource.reviewCount || 500,
    };

    // ── Call ML service via bridge ─────────────────────────────────────────
    const prediction = await getPricePrediction(
      id,
      historyDocs,    // pass raw Mongoose docs; bridge normalizes them
      productMeta,
      daysAhead,
    );

    // ── Derive recommendation from prediction result ────────────────────────
    // Only call /recommend if we got a valid predicted price
    let recommendation = null;
    if (prediction.predicted_price !== null) {
      recommendation = await getRecommendation(
        product.lowestPrice,
        prediction.predicted_price,
        prediction.trend,
      );
    }

    // ── Compute price statistics for UI ────────────────────────────────────
    const prices  = historyDocs.map((h) => h.price).filter((p) => p > 0);
    const stats   = prices.length ? {
      lowestRecorded:  Math.min(...prices),
      highestRecorded: Math.max(...prices),
      average:         Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      dataPoints:      prices.length,
      rangeSpan:       `${historyDocs[0]?.timestamp?.toISOString().split('T')[0]} → ${historyDocs.at(-1)?.timestamp?.toISOString().split('T')[0]}`,
    } : null;

    res.json({
      success: true,
      product: {
        id:           product._id,
        title:        product.title,
        currentPrice: product.lowestPrice,
        category:     product.category,
        imageUrl:     product.imageUrl,
      },
      prediction,
      recommendation,
      priceStats: stats,
      historyCount: historyDocs.length,
    });

  } catch (err) {
    next(err);
  }
};

// ─── 6. Purchase Redirect ─────────────────────────────────────────────────────
// GET /api/products/:id/redirect?platform=ebay
// Returns redirect URL. Frontend performs the actual navigation.
const getRedirectUrl = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { platform } = req.query;

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Find the source for the requested platform (or best deal if not specified)
    let source;
    if (platform && platform !== 'any') {
      source = product.sources.find((s) => s.platform === platform);
    }
    if (!source) {
      // Default to cheapest source
      source = product.sources.reduce(
        (prev, curr) => (curr.price < prev.price ? curr : prev),
        product.sources[0]
      );
    }

    if (!source || !source.link || source.link === '#') {
      return res.status(404).json({
        success: false,
        message: 'No valid purchase link found for this platform',
      });
    }

    // ── Open Redirect / XSS Mitigation ──────────────────────────────────────
    // Ensure the link is a valid HTTP/HTTPS URL, not a javascript: payload
    if (!source.link.startsWith('http://') && !source.link.startsWith('https://')) {
      logger.warn(`[Security] Blocked unsafe redirect URL: ${source.link}`);
      return res.status(400).json({
        success: false,
        message: 'Unsafe redirect URL detected',
      });
    }

    // Log the redirect for analytics (non-blocking)
    SearchHistory.create({
      userId: req.user?._id || null,
      query: product.title,
      clickedProductId: product._id,
      clickedProductTitle: product.title,
      resultCount: 1,
      source: 'web',
      ipAddress: req.ip,
    }).catch(() => {});

    // Invalidate cached product (search count changed)
    CacheManager.del(CacheManager.productKey(id));

    res.json({
      success: true,
      redirectUrl: source.link,
      platform: source.platform,
      price: source.price,
      currency: source.currency,
    });
  } catch (err) {
    next(err);
  }
};

// ─── 7. Trending Products ─────────────────────────────────────────────────────
// GET /api/products/trending?limit=12
const getTrendingProducts = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
    const cached = CacheManager.get(`trending:${limit}`);
    if (cached) return res.json({ ...cached, fromCache: true });

    // 1. Attempt to fetch live Walmart Rollbacks (non-fatal on failure)
    let validRollbacks = [];
    try {
      const rollbacksRaw = await getWalmartRollbacks(1);
      if (rollbacksRaw.length > 0) {
        const { getUsdToInrRate } = require('../services/currencyService');
        const { normalizeApiProduct } = require('../services/aggregator/sourceManager');
        const usdRate = await getUsdToInrRate().catch(() => null);
        const rollbacksNorm = await Promise.all(rollbacksRaw.map(item => normalizeApiProduct(item, 'Walmart', usdRate)));
        const savedRollbacks = await Promise.all(rollbacksNorm.map(upsertProduct));
        validRollbacks = savedRollbacks.filter(Boolean);
      }
    } catch (walmartErr) {
      logger.warn(`[TrendingProducts] Walmart rollback pipeline failed, using DB only: ${walmartErr.message}`);
    }

    // 2. Fetch trending from DB (always runs)
    const trending = await Product.findTrending(limit);

    // 3. Merge and deduplicate
    const mergedList = [...validRollbacks, ...trending];
    const uniqueIds = new Set();
    const finalProducts = [];
    for (const p of mergedList) {
      const id = p._id && p._id.toString();
      if (id && !uniqueIds.has(id)) {
        uniqueIds.add(id);
        finalProducts.push(toUnifiedResponse(p));
      }
    }

    const response = {
      success: true,
      count: finalProducts.length,
      products: finalProducts.slice(0, limit),
    };
    if (finalProducts.length > 0) {
      CacheManager.set(`trending:${limit}`, response, 300);
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ─── 8. Search Autocomplete ───────────────────────────────────────────────────
// GET /api/products/autocomplete?q=iph
const getAutocomplete = async (req, res, next) => {
  try {
    const { q } = req.query;
    const cacheKey = `autocomplete:${q.toLowerCase()}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return res.json(cached);

    // Query SearchHistory for matching normalized queries
    const suggestions = await SearchHistory.getTopQueries(30, 8).then((results) =>
      results
        .filter((r) => r.query.includes(q.toLowerCase()))
        .map((r) => r.query)
        .slice(0, 8)
    );

    // Also search product titles in DB
    const products = await Product.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' }, title: 1, _id: 1 }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(5)
      .lean();

    const productSuggestions = products.map((p) => p.title);

    // Merge, deduplicate, limit to 10
    const merged = [...new Set([...suggestions, ...productSuggestions])].slice(0, 10);

    const response = { success: true, suggestions: merged };
    CacheManager.set(cacheKey, response, 120); // 2-min TTL for autocomplete
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ─── 9. Toggle Watchlist ──────────────────────────────────────────────────────
// POST /api/products/:id/watchlist  [auth required]
const toggleWatchlist = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = req.user;
    const isWatched = user.watchlist.some((wid) => wid.toString() === productId);
    const update = isWatched
      ? { $pull: { watchlist: productId } }
      : { $addToSet: { watchlist: productId } };

    await user.constructor.findByIdAndUpdate(userId, update);
    cache.del(cache.productKey(productId));

    res.json({
      success: true,
      message: isWatched ? 'Removed from watchlist' : 'Added to watchlist',
      isWatched: !isWatched,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchProducts,
  getProductById,
  getPriceHistory,
  compareProduct,
  getPrediction,
  getRedirectUrl,
  getTrendingProducts,
  getAutocomplete,
  toggleWatchlist,
  getAmazonReviews,
};
