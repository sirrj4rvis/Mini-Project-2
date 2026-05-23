const cheerio = require('cheerio');
const BrowserFactory = require('../../shared/browserFactory');
const ScraperBase = require('../../shared/scraperBase');
const logger = require('../../shared/logger');
const DelayManager = require('../../antiblock/delayManager');
const RateLimiter = require('../../antiblock/rateLimiter');
const RetryStrategy = require('../../antiblock/retryStrategy');
const {
  normalizeFlipkartTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
} = require('./flipkart.normalizer');

// NOTE: Browser lifecycle and stealth scripts are managed by BrowserFactory.
// The globalBrowser singleton is owned by the factory, not this scraper.

class FlipkartScraper extends ScraperBase {
  constructor() {
    super({ sourceName: 'Flipkart', timeout: 35000 });
    this.baseUrl = 'https://www.flipkart.com';
  }

  buildSearchUrl(query) {
    const encodedQuery = encodeURIComponent(query);
    return `${this.baseUrl}/search?q=${encodedQuery}&marketplace=FLIPKART&as-show=on&as=off`;
  }

  async search(query) {
    this.logger.info(`Starting Playwright search for: "${query}"`);
    let context = null;
    let page = null;

    try {
      const pageHTML = await RetryStrategy.execute(async () => {
        await RateLimiter.throttle('flipkart.com', 3000);

        // ── 1. Hardened context from factory (stealth + correct UA pre-applied) ──
        context = await BrowserFactory.createHardenedContext({
          extraHTTPHeaders: {
            'Referer': 'https://www.flipkart.com/'
          }
        });

        // ── 2. Page with resource blocking from factory (allow images for lazy-loading) ──
        const allowedTypes = ['script', 'xhr', 'fetch', 'websocket', 'eventsource', 'manifest', 'other', 'document', 'image'];
        page = await BrowserFactory.createPage(context, allowedTypes);

        // ── 3. Cookie session pre-warm ──
        // Flipkart requires a valid session cookie before serving search results.
        this.logger.debug('[Flipkart] Pre-warming session via homepage...');
        await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.keyboard.press('Escape').catch(() => {});
        await DelayManager.randomSleep(700, 1400);

        // ── 4. Navigate to search ──
        const url = this.buildSearchUrl(query);
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        if (response && response.status() === 403) {
          throw new Error('Blocked by Flipkart WAF (403). Session may be stale.');
        }

        // ── 5. Wait for product grid ──
        const productSelector = 'div[data-id], div._1AtVbE, div.cPHDOP';
        await page.waitForSelector(productSelector, { state: 'attached', timeout: 15000 }).catch(() => null);

        // Force a multi-step scroll to trigger lazy-loading IntersectionObservers
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await DelayManager.randomSleep(500, 800);
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await DelayManager.randomSleep(1000, 1500);

        return await page.content();

      }, {
        context: `Flipkart Playwright [${query}]`,
        maxRetries: 2,
        baseDelayMs: 4000,
        isPlaywright: true
      });

      // ── 9. Parse with Cheerio ──
      const rawProducts = await this.extractData(pageHTML);
      if (!rawProducts || rawProducts.length === 0) {
        this.logger.warn(`No products parsed for: "${query}"`);
        return [];
      }

      const normalizedProducts = rawProducts.map(item => {
        try { return this.normalizeProduct(item); } catch { return null; }
      }).filter(Boolean);

      this.logger.info(`Successfully extracted ${normalizedProducts.length} products for: "${query}"`);
      return normalizedProducts;

    } catch (error) {
      this.logger.error(`Search failed for "${query}": ${error.message}`);
      return [];
    } finally {
      // Always clean up to prevent memory leaks in long-running server processes
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  /**
   * Parses the Flipkart search result HTML using Cheerio.
   * data-id is a structurally stable anchor — Flipkart has never removed it.
   * All CSS class names are multi-fallback to survive Flipkart's weekly rotations.
   */
  async extractData(html) {
    const $ = cheerio.load(html);
    const results = [];

    // Primary anchor: data-id is the only structurally stable marker Flipkart has maintained.
    // Fallback anchors cover alternate grid layouts (cPHDOP = 2024 grid wrapper, _1AtVbE = older grid).
    const cardSelector = 'div[data-id], div.cPHDOP div[class*="col"], div._1AtVbE';

    $(cardSelector).each((i, el) => {
      const $el = $(el);

      // ── Title ──
      // Flipkart rotates CSS class names every 2-4 weeks. We cascade through 10 known variants.
      // Final fallback: img alt text (Flipkart always populates this with the product name).
      const rawTitle = $el.find([
        'div._4rR01T',    // Classic list layout (2021–2024)
        'div.KzDlHZ',    // Alternate list layout
        'a.IRpwTa',      // Category-specific link variant
        'a.s1Q9rs',      // Fashion grid
        'a.WKTcLC',      // Electronics list
        'div.wjcEIp',    // 2024 grid title
        'div._2WkVRV',   // 2025 grid title
        'a[class*="title"]',     // Generic class-fragment fallback
        'div[class*="title"]',
        'span[class*="title"]'
      ].join(', ')).first().text().trim() || $el.find('img').first().attr('alt')?.trim() || '';

      if (!rawTitle || rawTitle.length < 3) return;

      // ── Price ──
      // Attempt 1: Known class name variants
      let priceText = $el.find([
        'div._30jeq3',       // Classic price (2021–2024)
        'div.Nx9bqj',        // 2023 grid variant
        'div.hl05eU',        // 2024 variant
        'div._25b18c span',  // Nested price span
        'div.yRaY8j',        // 2025 variant
        'div[class*="price"]',
        'span[class*="price"]'
      ].join(', ')).first().text().trim();

      // Attempt 2: Look for any text node containing the ₹ rupee symbol
      if (!priceText) {
        $el.find('*').each((_, node) => {
          const text = $(node).clone().children().remove().end().text().trim();
          if (text.includes('₹') && text.length < 15) {
            priceText = text;
            return false; // break
          }
        });
      }

      if (!priceText) return;

      // ── Image ──
      let image = '';
      $el.find('img').each((_, img) => {
        const src = $(img).attr('src') || '';
        const lazySrc = $(img).attr('data-src') || $(img).attr('data-lazy-src') || '';
        const candidate = lazySrc || src;
        
        if (candidate && !candidate.includes('placeholder') && !candidate.includes('fa_') && !candidate.startsWith('data:image')) {
          image = candidate;
          return false; // break loop
        }
      });
      
      if (!image) {
        // Fallback: If no valid image found, it might be in a background-image div
        image = $el.find('[style*="background-image"]').first().css('background-image')?.replace(/url\(['"]?(.*?)['"]?\)/i, '$1') || '';
      }

      // ── Rating & Reviews ──
      const ratingText = $el.find([
        'div._3LWZlK', 'div.XQDdHH', 'div.ipqd2A',
        'span[class*="rating"]', 'div[class*="rating"]'
      ].join(', ')).first().text().trim();

      const reviewText = $el.find([
        'span._2_R_DZ', 'span.Wphh3N', 'span._13vcmD',
        'span[class*="review"]', 'span[class*="rating-count"]'
      ].join(', ')).first().text().trim();

      // ── Availability ──
      const outOfStock = $el.find('[class*="out-of-stock"], [class*="outOfStock"], [class*="sold-out"]').length > 0;
      const availability = outOfStock ? 'Out of Stock' : 'In Stock';

      // ── Link ──
      let link = $el.find('a[href*="/p/"]').first().attr('href') || $el.find('a').first().attr('href') || '';
      if (link && !link.startsWith('http')) link = this.baseUrl + link;
      // Strip tracking params but keep the /p/ product path
      if (link) link = link.split('?')[0];

      results.push({ rawTitle, priceText, image, ratingText, reviewText, link, availability });
    });

    this.logger.debug(`[Flipkart] Parsed ${results.length} raw items from HTML`);
    // PERF: Explicitly destroy Cheerio's parse5 DOM tree after extraction.
    // Without this, closures inside .each() callbacks keep the entire parsed HTML
    // tree referenced in heap, causing +30-50MB per scrape call that never GC'd.
    $.root().empty();
    return results;
  }

  normalizeProduct(rawProduct) {
    const title = rawProduct.rawTitle;
    const price = parsePrice(rawProduct.priceText);
    if (!title || price <= 0) {
      throw new Error(`Invalid data: title="${title}", price="${rawProduct.priceText}"`);
    }
    return {
      title,
      normalizedTitle: normalizeFlipkartTitle(title),
      price,
      currency: 'INR',
      image: rawProduct.image || '',
      rating: parseRating(rawProduct.ratingText),
      reviewCount: parseReviewCount(rawProduct.reviewText),
      source: this.sourceName,
      category: determineCategory(title),
      availability: rawProduct.availability || 'In Stock',
      link: rawProduct.link || '',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = FlipkartScraper;
