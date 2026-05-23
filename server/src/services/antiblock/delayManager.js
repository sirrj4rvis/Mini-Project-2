/**
 * Advanced Delay Manager for Scraping operations.
 * Implements human-like timing variations to avoid detectable heartbeat patterns.
 */
class DelayManager {
  /**
   * Hard delay - blocks execution for exact milliseconds
   * @param {number} ms 
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Humanized delay - blocks for a random time between min and max bounds.
   * Essential for making automated requests look like organic user traffic.
   */
  static async randomSleep(minMs = 1000, maxMs = 3000) {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return this.sleep(ms);
  }

  /**
   * Scrolling simulation delay - micro-pauses commonly seen during human scrolling
   * or reading behavior. Useful for Playwright scripts.
   */
  static async microDelay() {
    return this.randomSleep(100, 400);
  }
}

module.exports = DelayManager;
