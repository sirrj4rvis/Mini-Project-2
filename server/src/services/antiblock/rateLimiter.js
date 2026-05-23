const DelayManager = require('./delayManager');

/**
 * Global Rate Limiter to prevent IP bans.
 * Tracks request concurrency and enforces strict cooldowns per domain.
 */
class RateLimiter {
  constructor() {
    this.domainLocks = new Map();
  }

  /**
   * Acquires a timing lock for a domain, ensuring requests are spaced out.
   * If a request was recently made to this domain, it forces a localized delay.
   * 
   * @param {string} domain - The target domain (e.g., 'amazon.in', 'myntra.com')
   * @param {number} minSpacingMs - Minimum time required between requests
   */
  async throttle(domain, minSpacingMs = 2500) {
    const now = Date.now();
    const lastRequest = this.domainLocks.get(domain) || 0;
    
    const timeSinceLast = now - lastRequest;
    
    // If we are hitting the domain too fast, force a wait
    if (timeSinceLast < minSpacingMs) {
      // Add a slight random jitter (0-500ms) to the calculated wait time
      // to ensure concurrent requests don't all wake up at the exact same millisecond
      const waitTime = (minSpacingMs - timeSinceLast) + Math.floor(Math.random() * 500);
      await DelayManager.sleep(waitTime);
    }
    
    // Update the lock time
    this.domainLocks.set(domain, Date.now());
  }

  /**
   * Clears all tracking data. Useful for test teardowns.
   */
  reset() {
    this.domainLocks.clear();
  }
}

// Export as a Singleton so the state is shared across all concurrent scraper instances
module.exports = new RateLimiter();
