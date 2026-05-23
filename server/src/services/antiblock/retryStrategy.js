const DelayManager = require('./delayManager');
const logger = require('../shared/logger'); 

// Standard HTTP codes that indicate temporary failure or rate limiting
const RETRYABLE_ERRORS = [408, 429, 500, 502, 503, 504];

/**
 * Universal Retry Engine supporting both Axios (HTTP) and Playwright (Browser) paradigms.
 * Implements "Exponential Backoff with Full Jitter" algorithm.
 */
class RetryStrategy {
  /**
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Retry configuration
   * @returns {Promise<any>}
   */
  static async execute(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelayMs = 2000,
      context = 'ScraperOperation',
      isPlaywright = false
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        let isRetryable = false;
        let status = null;

        // 1. Error parsing based on execution context
        if (isPlaywright) {
          // Playwright specific network/bot errors
          const msg = error.message.toLowerCase();
          isRetryable = msg.includes('timeout') || 
                        msg.includes('closed') || 
                        msg.includes('reset') || 
                        msg.includes('403'); // Often a temporary WAF block
        } else {
          // Axios HTTP specific errors
          status = error.response?.status;
          
          // Check for RapidAPI hard quota exhaustion (x-ratelimit-requests-remaining)
          const rapidApiRemaining = error.response?.headers?.['x-ratelimit-requests-remaining'];
          if (status === 429 && rapidApiRemaining === '0') {
            logger.error('[RetryEngine] RapidAPI Quota Exhausted! Aborting retries immediately.');
            isRetryable = false;
          } else if (status === 401) {
            // 401 Unauthorized - allow retry to support OAuth token refresh (e.g. eBay)
            isRetryable = true;
          } else {
            isRetryable = !status || RETRYABLE_ERRORS.includes(status) || error.code === 'ECONNABORTED';
          }
        }
        
        // 2. Failure determination
        if (!isRetryable || attempt === maxRetries) {
          logger.error(`[RetryEngine] ${context} failed permanently after ${attempt} attempts. Error: ${error.message}`);
          throw error; // Throw upward to graceful failure handler
        }

        // 3. Full Jitter Algorithm (AWS standard for preventing thundering herds)
        // formula: wait = random_between(min, baseDelay * 2^(attempt-1))
        const maxWait = baseDelayMs * Math.pow(2, attempt - 1);
        const waitTime = Math.floor(Math.random() * maxWait) + 800; // minimum 800ms buffer
        
        logger.warn(`[RetryEngine] ${context} encountered an error (Attempt ${attempt}/${maxRetries}). Retrying in ${waitTime}ms...`);
        await DelayManager.sleep(waitTime);
      }
    }

    // Bug 1 fix: Loop exhausted without returning or throwing — guarantee rejection.
    throw lastError || new Error(`[RetryEngine] ${context} exhausted all ${maxRetries} retries.`);
  }
}

module.exports = RetryStrategy;
