/**
 * Realistic User-Agent and Header Rotator.
 * Maintains a statistically accurate pool of high-market-share modern browsers
 * to blend scraping traffic into normal user traffic.
 */
const modernUserAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
];

class UserAgentRotator {
  /**
   * Retrieves a random modern User-Agent string.
   */
  static getRandomAgent() {
    return modernUserAgents[Math.floor(Math.random() * modernUserAgents.length)];
  }

  /**
   * Generates a complete set of HTTP headers designed to perfectly mimic
   * a real browser request. Useful for Axios.
   */
  static getRealisticHeaders() {
    return {
      "User-Agent": this.getRandomAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9,en-GB;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      "DNT": "1" // Do Not Track
    };
  }

  /**
   * Specifically formatted configuration object for Playwright Contexts.
   */
  static getPlaywrightContext() {
    return {
      userAgent: this.getRandomAgent(),
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1'
      }
    };
  }
}

module.exports = UserAgentRotator;
