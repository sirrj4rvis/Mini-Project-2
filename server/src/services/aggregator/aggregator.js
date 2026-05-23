const { getActiveSources } = require('./sourceManager');
const { executeParallelSearch } = require('./parallelSearch');
const { deduplicateProducts } = require('./deduplicator');
const { rankProducts } = require('./rankingEngine');
const SearchIntelligenceEngine = require('../intelligence/searchIntelligenceEngine');
const Canonicalizer = require('../canonicalization/canonicalizer');
const RecommendationEngine = require('../recommendations/recommendationEngine');
const CacheManager = require('../cache/cacheManager');
const logger = require('../shared/logger');

/**
 * Main Aggregation Engine Entry Point.
 * Receives a search query, checks the cache, triggers parallel extraction across all sources,
 * normalizes the data, deduplicates, ranks, caches, and merges the responses into a single unified payload.
 * 
 * @param {string} query - The raw search term from the user
 * @returns {Promise<Object>} - Unified API response structure
 */
async function aggregateSearch(query) {
  logger.info(`[Aggregator] Initiating unified search for: "${query}"`);
  const startTime = Date.now();

  // 1. Check the Cache First (Instant Response)
  const cachedResults = await CacheManager.getCachedResults(query);
  if (cachedResults) {
    return {
      query: query,
      totalItems: cachedResults.length,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      source: 'Cache',
      results: cachedResults
    };
  }

  // ── Phase 1: Search Intelligence (Query Understanding) ──
  const queryContext = SearchIntelligenceEngine.parseQuery(query);

  // 2. Resolve dependencies and get all active sources (APIs + Scrapers)
  // Pass the mathematically cleaned query so scrapers don't fail on typos or intent adjectives
  const sources = getActiveSources(queryContext.cleanSearchQuery);

  if (sources.length === 0) {
    logger.warn('[Aggregator] No sources available to execute the search.');
    return { query, totalItems: 0, executionTimeMs: 0, results: [] };
  }

  // 3. Execute all sources in parallel with strict graceful failure boundaries
  const rawUnifiedResults = await executeParallelSearch(sources, 30000); // 30s max SLA limit

  // 4. Run the Canonicalization Engine to standardize identities and build precise signatures
  const canonicalizedResults = Canonicalizer.process(rawUnifiedResults);

  // 5. Run the Deduplication Engine to group identical cross-platform products
  const deduplicatedResults = deduplicateProducts(canonicalizedResults);

  // 5. Run the Structural Ranking Engine to surface the best basic deals
  const structurallyRanked = rankProducts(deduplicatedResults, queryContext.cleanSearchQuery);

  // ── Phase 2: Search Intelligence (Semantic Intent Re-Ranking) ──
  const intelligentlyScored = SearchIntelligenceEngine.applyIntelligence(structurallyRanked, queryContext);

  // ── Phase 3: Recommendation Engine (Dynamic Buying Badges) ──
  const finalResults = RecommendationEngine.process(intelligentlyScored);

  // 6. Save to Cache and trigger historical price tracking
  // Bug 10 fix: A cache write failure must never crash the response path.
  // Results are already computed — we fire-and-forget with non-propagating error logging.
  CacheManager.saveResults(query, finalResults).catch((err) => {
    logger.error(`[Aggregator] CacheManager.saveResults failed (non-fatal): ${err.message}`);
  });

  const executionTimeMs = Date.now() - startTime;
  logger.info(`[Aggregator] Completed search for "${query}". Found ${finalResults.length} total unique items across ${sources.length} sources in ${executionTimeMs}ms.`);

  // 7. Return canonical unified response structure
  return {
    query: query,
    totalItems: finalResults.length,
    executionTimeMs: executionTimeMs,
    timestamp: new Date().toISOString(),
    source: 'Live',
    results: finalResults
  };
}

module.exports = { aggregateSearch };
