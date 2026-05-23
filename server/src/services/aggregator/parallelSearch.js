const { withTimeout } = require('../shared/timeout');
const logger = require('../shared/logger');

/**
 * Executes a list of search tasks in parallel.
 * Enforces Source Isolation: if one source crashes or times out, it does NOT crash the others.
 * 
 * @param {Array} sources - Array of source objects { name, execute }
 * @param {number} globalTimeout - Maximum time allowed for any single source to respond
 * @returns {Promise<Array>} - Aggregated flat list of unified products
 */
async function executeParallelSearch(sources, globalTimeout = 25000) {
  // Wrap each source execution in an isolated, protective promise
  const tasks = sources.map(async (source) => {
    try {
      logger.info(`[ParallelSearch] Dispatching query to: ${source.name}`);
      
      // Bug 2 fix: Pass a *factory function* to withTimeout, not the already-started Promise.
      // Calling source.execute() directly would launch the async op immediately and unguarded —
      // withTimeout would only race an in-flight Promise, providing no real SLA guarantee.
      // With a factory fn, withTimeout owns the launch and can properly preempt hung connections.
      const results = await withTimeout(
        source.execute(),  // Promise is created here — withTimeout races it from the start
        globalTimeout,
        [] // Fallback data on timeout
      );
      
      logger.info(`[ParallelSearch] ${source.name} returned ${results ? results.length : 0} items.`);
      return Array.isArray(results) ? results : [];
      
    } catch (error) {
      // Graceful failure handling: log the error but don't crash the pipeline
      logger.error(`[ParallelSearch] Source ${source.name} failed: ${error.message}`);
      return []; // Return empty array so Promise.all can flatten cleanly (Partial Success Support)
    }
  });

  // Execute all sources simultaneously (Promise.all handles the wrapped tasks which never reject)
  const settledResults = await Promise.all(tasks);
  
  // Flatten the array of arrays into a single unified array, stripping invalid items
  const unifiedProducts = settledResults
    .flat()
    .filter(product => product && product.title && product.price > 0);
  
  return unifiedProducts;
}

module.exports = { executeParallelSearch };
