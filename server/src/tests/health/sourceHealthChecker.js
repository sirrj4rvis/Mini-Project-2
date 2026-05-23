const { getActiveSources } = require('../../services/aggregator/sourceManager');
const SourceValidator = require('./sourceValidator');
const { testQueries } = require('./testSearchQueries');
const logger = require('../../services/shared/logger');

/**
 * Production-Grade Source Health Checker.
 * Iterates through all integrated APIs and Scrapers, fires live test queries,
 * measures latency, and runs validation on the extracted data to ensure structural integrity.
 */
class SourceHealthChecker {
  static async runFullDiagnostic() {
    logger.info('========== STARTING SOURCE HEALTH DIAGNOSTIC ==========');
    
    // Randomly select one query from the test pool to avoid predictable bot patterns during testing
    const testQuery = testQueries[Math.floor(Math.random() * testQueries.length)];
    logger.info(`Selected Live Test Query: "${testQuery}"`);

    // Instantiate sources directly via the manager to ensure we test 
    // the exact same instances the production aggregator uses.
    const sources = getActiveSources(testQuery);
    
    if (sources.length === 0) {
      logger.error('CRITICAL: No active sources found in SourceManager.');
      return;
    }

    const healthReport = [];

    // Run sequentially to easily debug which source fails and prevent local CPU/Memory/Network overload
    for (const source of sources) {
      logger.info(`Testing Source: [${source.name}] (${source.type})...`);
      
      const startTime = Date.now();
      let rawResults = [];
      let executionError = null;

      try {
        // Trigger the live scrape/API call
        rawResults = await source.execute();
      } catch (err) {
        executionError = err.message;
        logger.error(`[${source.name}] Execution completely failed: ${err.message}`);
      }

      const responseTimeMs = Date.now() - startTime;
      
      // Pass the payload into the rigorous validation engine
      const validationReport = SourceValidator.generateReport(rawResults || []);

      const sourceMetrics = {
        sourceName: source.name,
        type: source.type,
        status: executionError ? 'FAIL' : (validationReport.validItems > 0 ? 'HEALTHY' : 'DEGRADED'),
        responseTimeMs,
        executionError,
        metrics: validationReport
      };

      healthReport.push(sourceMetrics);
      
      // Print localized status stream
      logger.info(`[${source.name}] Status: ${sourceMetrics.status} | Score: ${validationReport.qualityScore}/100 | Time: ${responseTimeMs}ms | Items: ${validationReport.totalItems}`);
    }

    logger.info('========== DIAGNOSTIC COMPLETE ==========');
    
    return this.summarizeReport(healthReport);
  }

  /**
   * Formats the final diagnostic run into a clean console table for developer review.
   */
  static summarizeReport(report) {
    console.log('\n--- PLATFORM SOURCE HEALTH SUMMARY ---');
    console.table(report.map(r => ({
      Source: r.sourceName,
      Type: r.type,
      Status: r.status,
      'Score / 100': r.metrics.qualityScore,
      'Resp Time (ms)': r.responseTimeMs,
      Items: r.metrics.totalItems,
      Issues: r.executionError || (r.metrics.criticalErrors.length ? r.metrics.criticalErrors.join(', ') : 'None')
    })));
    return report;
  }
}

// Allow running this script directly via Node in the terminal: 
// node d:/CODING/Mini_Project/server/src/tests/health/sourceHealthChecker.js
if (require.main === module) {
  SourceHealthChecker.runFullDiagnostic()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal diagnostic error:', err);
      process.exit(1);
    });
}

module.exports = SourceHealthChecker;
