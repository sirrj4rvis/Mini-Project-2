/**
 * Playwright Browser Factory
 *
 * Centralized, production-grade factory for creating hardened Playwright
 * browser instances and contexts. All Playwright-based scrapers should use
 * this factory instead of calling chromium.launch() directly.
 *
 * Responsibilities:
 *  - Single shared browser instance per process (performance)
 *  - Isolated browser context per scraping session (data isolation + memory safety)
 *  - All stealth scripts injected before page navigation
 *  - Consistent Chrome 124 fingerprint identity across all contexts
 *  - Graceful browser lifecycle management (no zombie processes)
 */

const { chromium } = require('playwright');
const { getAllStealthScripts } = require('./stealthScripts');
const logger = require('./logger');

// ── Pinned Browser Identity ──
// All fingerprint-sensitive headers must reference the SAME Chrome version.
// Mixing versions (e.g., UA says "124" but sec-ch-ua says "121") is an immediate bot flag.
const BROWSER_IDENTITY = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  secChUa: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  viewport: { width: 1366, height: 768 },
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata'
};

// ── Shared Browser Instance ──
// One Chromium process is shared across ALL scraper calls in the same Node process.
// Each scraping request gets an isolated "context" (like an incognito window),
// which is cheap to create and destroy. The browser itself is expensive to launch.
let sharedBrowser = null;
let isLaunching = false;
const launchWaiters = [];

class BrowserFactory {
  
  /**
   * Returns the shared Chromium browser, launching it if necessary.
   * Thread-safe: concurrent calls wait for a single launch to complete.
   */
  static async getBrowser() {
    if (sharedBrowser && sharedBrowser.isConnected()) {
      return sharedBrowser;
    }

    // If a launch is already in progress, queue up and wait
    if (isLaunching) {
      return new Promise((resolve, reject) => {
        launchWaiters.push({ resolve, reject });
      });
    }

    isLaunching = true;
    logger.info('[BrowserFactory] Launching shared Chromium instance...');

    try {
      sharedBrowser = await chromium.launch({
        headless: true,
        args: [
          // ── Core Anti-Detection Args ──
          '--disable-blink-features=AutomationControlled',

          // ── Sandbox (required for containerized/non-root environments) ──
          '--no-sandbox',
          '--disable-setuid-sandbox',

          // ── Memory & Performance ──
          '--disable-dev-shm-usage',  // Prevent /dev/shm OOM crashes in Docker
          '--disable-gpu',            // No GPU needed for headless
          '--no-first-run',
          '--no-zygote',

          // ── Network Protocol ──
          '--disable-quic',           // Disables QUIC (HTTP/3)
          '--disable-http2',          // Forces HTTP/1.1 to bypass Akamai HTTP/2 fingerprinting
                                      // Fixes ERR_HTTP2_PROTOCOL_ERROR on Myntra CDN edge

          // ── Stability ──
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',

          // ── Window Size (must match our viewport) ──
          '--window-size=1366,768'
        ]
      });

      logger.info('[BrowserFactory] Chromium launched successfully.');

      // Auto-recover if the browser crashes unexpectedly
      sharedBrowser.on('disconnected', () => {
        logger.warn('[BrowserFactory] Chromium disconnected unexpectedly. Will relaunch on next request.');
        sharedBrowser = null;
      });

      // Notify any queued waiters
      launchWaiters.forEach(w => w.resolve(sharedBrowser));
      launchWaiters.length = 0;

      return sharedBrowser;

    } catch (err) {
      logger.error(`[BrowserFactory] Failed to launch Chromium: ${err.message}`);
      launchWaiters.forEach(w => w.reject(err));
      launchWaiters.length = 0;
      throw err;
    } finally {
      isLaunching = false;
    }
  }

  /**
   * Creates a fully hardened, isolated browser context.
   * Each scraping session should call this and close the context when done.
   *
   * @param {Object} overrides - Optional overrides for context options
   * @returns {{ context, injectStealth }} 
   *   - context: The Playwright BrowserContext
   *   - injectStealth: Async function — call this after creating the context, before goto
   */
  static async createHardenedContext(overrides = {}) {
    const browser = await this.getBrowser();

    const context = await browser.newContext({
      userAgent: BROWSER_IDENTITY.userAgent,
      viewport: BROWSER_IDENTITY.viewport,
      locale: BROWSER_IDENTITY.locale,
      timezoneId: BROWSER_IDENTITY.timezoneId,
      javaScriptEnabled: true,
      bypassCSP: true,
      // Merge site-specific headers with the core identity headers
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': BROWSER_IDENTITY.secChUa,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
        ...(overrides.extraHTTPHeaders || {})
      },
      ...overrides
    });

    // Inject all stealth patches into this context
    // MUST run before any page.goto() call
    await context.addInitScript(getAllStealthScripts());

    return context;
  }

  /**
   * Creates a new page inside a hardened context with resource blocking.
   * Blocks images, fonts, and media by default for performance.
   *
   * @param {BrowserContext} context
   * @param {string[]} allowedTypes - Resource types NOT to block. Defaults to scripts + xhr.
   * @returns {Page}
   */
  static async createPage(context, allowedTypes = ['script', 'xhr', 'fetch', 'websocket', 'eventsource', 'manifest', 'other', 'document']) {
    const page = await context.newPage();

    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (allowedTypes.includes(type)) {
        route.continue();
      } else {
        route.abort();
      }
    });

    return page;
  }

  /**
   * Gracefully closes the shared browser.
   * Should only be called on process exit, not between scraping sessions.
   */
  static async closeBrowser() {
    if (sharedBrowser) {
      logger.info('[BrowserFactory] Closing shared Chromium instance.');
      await sharedBrowser.close().catch(() => {});
      sharedBrowser = null;
    }
  }

  /**
   * Returns the pinned browser identity constants for use in scrapers
   * that need to add identity-matching values to custom headers.
   */
  static getIdentity() {
    return { ...BROWSER_IDENTITY };
  }
}

// ── Process Lifecycle Hooks ──
// These ensure no zombie Chromium processes are left behind when Node exits.
['SIGINT', 'SIGTERM', 'exit'].forEach(signal => {
  process.once(signal, async () => {
    await BrowserFactory.closeBrowser();
    if (signal !== 'exit') process.exit(0);
  });
});

module.exports = BrowserFactory;
