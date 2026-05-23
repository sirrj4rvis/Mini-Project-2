const cheerio = require('cheerio');
const BrowserFactory = require('../../shared/browserFactory');
const ScraperBase = require('../../shared/scraperBase');
const {
  normalizeCromaTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
} = require('./croma.normalizer');
const DelayManager = require('../../antiblock/delayManager');
const RateLimiter = require('../../antiblock/rateLimiter');
const RetryStrategy = require('../../antiblock/retryStrategy');

class CromaScraper extends ScraperBase {
  constructor() {
    super({ sourceName: 'Croma', timeout: 25000 });
    this.baseUrl = 'https://www.croma.com';
  }

  buildSearchUrl(query) {
    const encodedQuery = encodeURIComponent(query);
    // Croma's working search endpoint (searchB alias was removed in late 2024)
    return `${this.baseUrl}/search?q=${encodedQuery}%3Arelevance`;
  }

  /**
   * Overrides base search to inject Croma-specific headers (Referer is validated).
   */
  async search(query) {
    this.logger.info(`Starting Playwright search for: "${query}"`);
    let context = null;
    let page = null;

    try {
      const pageHTML = await RetryStrategy.execute(async () => {
        await RateLimiter.throttle('croma.com', 3000);

        context = await BrowserFactory.createHardenedContext({
          extraHTTPHeaders: { 'Referer': 'https://www.croma.com/' }
        });
        page = await BrowserFactory.createPage(context);

        const url = this.buildSearchUrl(query);
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Bug 14 fix: WAF block detection was incorrectly commented out.
        // Without it, a 403 block causes the scraper to silently return empty results
        // with no retry triggered — indistinguishable from a real "no results" page.
        const status = response ? response.status() : 0;
        if (status === 403) throw new Error('Blocked by Croma WAF (403). Will retry.');
        if (status === 429) throw new Error('Rate limited by Croma (429). Backing off.');

        // Wait for React to render products instead of blindly sleeping
        const productSelector = 'div[data-testid="product-card"], li[class*="product"], div.product-item, div.cp-product';
        await page.waitForSelector(productSelector, { state: 'attached', timeout: 15000 }).catch(() => null);
        
        // Trigger lazy loading
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await DelayManager.randomSleep(500, 800);
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await DelayManager.randomSleep(500, 1000);

        return await page.content();
      }, {
        context: `Croma Playwright [${query}]`,
        maxRetries: 2,
        baseDelayMs: 2000,
        isPlaywright: true
      });

      const rawData = await this.extractData(pageHTML);
      if (!rawData || rawData.length === 0) {
        this.logger.warn(`No results found for: "${query}"`);
        return [];
      }
      const normalizedProducts = rawData.map(item => {
        try { return this.normalizeProduct(item); } catch { return null; }
      }).filter(Boolean);
      this.logger.info(`Successfully extracted ${normalizedProducts.length} products for: "${query}"`);
      return normalizedProducts;
    } catch (error) {
      this.logger.error(`Search failed for "${query}": ${error.message}`);
      return [];
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  /**
   * Parses the HTML using Cheerio to extract raw product points.
   * Handles various Croma SSR layout structures.
   */
  async extractData(html) {
    const $ = cheerio.load(html);
    const results = [];

    const cardSelector = [
      'div[data-testid="product-card"]',
      'li[class*="product"]',
      'div[class*="product-item"]',
      'div[class*="productCard"]',
      'div.product-item', 'li.product-item', 'div.cp-product'
    ].join(', ');

    $(cardSelector).each((i, el) => {
      const $el = $(el);

      // Title
      let rawTitle = $el.find([
        '[data-testid="product-title"]', '[data-testid="plp-product-title"]',
        'h3.product-title a', 'a.product-title', 'h3 a', 'h3',
        'a[class*="title"]', 'p[class*="title"]'
      ].join(', ')).first().text().trim();
      if (!rawTitle) {
        $el.find('a').each((_, a) => { const t = $(a).text().trim(); if (t.length > rawTitle.length) rawTitle = t; });
      }
      if (!rawTitle || rawTitle.length < 3) return;

      // Price
      let priceText = $el.find([
        '[data-testid="product-price"]', '[data-testid="plp-product-price"]',
        'span.amount', 'span.new-price', 'span[class*="price"]',
        'div[class*="price"]', 'p[class*="price"]'
      ].join(', ')).first().text().trim();
      if (!priceText) {
        $el.find('*').each((_, node) => {
          const t = $(node).clone().children().remove().end().text().trim();
          if (t.startsWith('₹') && t.length < 15) { priceText = t; return false; }
        });
      }
      if (!priceText) return;

      // Image
      const imgEl = $el.find('img').first();
      let image = imgEl.attr('src') || '';
      if (!image || image.startsWith('data:')) {
        image = imgEl.attr('data-src') || imgEl.attr('data-lazy') || imgEl.attr('data-original') || '';
      }

      // Rating & Reviews
      const ratingText = $el.find([
        '[data-testid="product-rating"]', 'span.rating', 'div.rating',
        'span.badge', 'span[class*="rating"]'
      ].join(', ')).first().text().trim();
      const reviewText = $el.find([
        'span.review-count', 'span.count', 'span.votes', 'span[class*="review"]'
      ].join(', ')).first().text().trim();

      // Availability
      const oos = $el.find('[class*="out-of-stock"],[class*="outOfStock"],[class*="soldOut"]').length > 0
        || $el.text().toLowerCase().includes('out of stock');
      const availability = oos ? 'Out of Stock' : 'In Stock';

      // Link
      let link = $el.find('a[href*="/p/"], a[href*="/buy"]').first().attr('href')
        || $el.find('a').first().attr('href') || '';
      if (link && !link.startsWith('http')) link = this.baseUrl + (link.startsWith('/') ? '' : '/') + link;
      if (link) link = link.split('?')[0];

      results.push({ rawTitle, priceText, image, ratingText, reviewText, link, availability });
    });

    this.logger.debug(`[Croma] Parsed ${results.length} raw items from HTML`);
    // PERF: Explicitly destroy Cheerio's parse5 DOM tree after extraction
    $.root().empty();
    return results;
  }

  /**
   * Converts the raw scraped item into the Unified Schema using normalizer utils.
   */
  normalizeProduct(rawProduct) {
    const title = rawProduct.rawTitle;
    const price = parsePrice(rawProduct.priceText);
    if (!title || price <= 0) {
      throw new Error(`Invalid data: title="${title}", price="${rawProduct.priceText}"`);
    }
    return {
      title,
      normalizedTitle: normalizeCromaTitle(title),
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

module.exports = CromaScraper;
