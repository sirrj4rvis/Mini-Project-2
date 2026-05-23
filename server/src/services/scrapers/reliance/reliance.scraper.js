const cheerio = require('cheerio');
const BrowserFactory = require('../../shared/browserFactory');
const ScraperBase = require('../../shared/scraperBase');
const {
  normalizeRelianceTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
} = require('./reliance.normalizer');
const DelayManager = require('../../antiblock/delayManager');
const RateLimiter = require('../../antiblock/rateLimiter');
const RetryStrategy = require('../../antiblock/retryStrategy');

class RelianceScraper extends ScraperBase {
  constructor() {
    super({ sourceName: 'Reliance Digital', timeout: 25000 });
    this.baseUrl = 'https://www.reliancedigital.in';
  }

  buildSearchUrl(query) {
    const encodedQuery = encodeURIComponent(query);
    // Reliance Digital uses ElasticSearch-backed endpoint. The :relevance suffix orders by best match.
    return `${this.baseUrl}/search?q=${encodedQuery}:relevance`;
  }

  /**
   * Overrides base search to inject Reliance-specific headers.
   * Their CDN validates Origin and Referer headers for non-API requests.
   */
  async search(query) {
    this.logger.info(`Starting Playwright search for: "${query}"`);
    let context = null;
    let page = null;

    try {
      const pageHTML = await RetryStrategy.execute(async () => {
        await RateLimiter.throttle('reliancedigital.in', 3000);

        context = await BrowserFactory.createHardenedContext({
          extraHTTPHeaders: { 
            'Referer': 'https://www.reliancedigital.in/',
            'Origin': 'https://www.reliancedigital.in'
          }
        });
        page = await BrowserFactory.createPage(context);

        const url = this.buildSearchUrl(query);
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        if (response && response.status() === 403) {
          throw new Error('Blocked by Reliance WAF (403).');
        }

        // Wait for React to render products instead of blindly sleeping
        const productSelector = 'li.sp, div.sp__product, div[class*="product-item"], div[class*="productCard"], .product-box, .slider-box';
        await page.waitForSelector(productSelector, { state: 'attached', timeout: 15000 }).catch(() => null);

        // Trigger lazy loading
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await DelayManager.randomSleep(500, 800);
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await DelayManager.randomSleep(500, 1000);

        return await page.content();
      }, {
        context: `Reliance Playwright [${query}]`,
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
   * Handles Reliance Digital's specific class structures.
   */
  async extractData(html) {
    const $ = cheerio.load(html);
    const results = [];

    const cardSelector = [
      'li.sp', 'div.sp__product',
      'div[class*="product-item"]', 'div[class*="productCard"]',
      'div[class*="ProductCard"]',
      '.product-box', '.slider-box'
    ].join(', ');

    $(cardSelector).each((i, el) => {
      const $el = $(el);

      // Title
      const titleEl = $el.find([
        'p.sp__name', '.product-title', '.p__name',
        'p[class*="name"]', 'div[class*="title"]',
        'span[class*="name"]', 'h3'
      ].join(', ')).first();
      const rawTitle = titleEl.text().trim() || $el.find('.name').text().trim();
      if (!rawTitle || rawTitle.length < 3) return;

      // Price: Reliance uses styled-components with hashed class names.
      // We cascade from stable class names to prefix wildcards to a ₹ symbol scan.
      let priceText = $el.find([
        'span.sp__price', 'span.price',
        'span[class*="price"]', 'div[class*="price"]',
        '.gHqbb', 'span[class^="TextWeb"]'
      ].join(', ')).first().text().trim();
      if (!priceText) {
        $el.find('span, div').each((_, node) => {
          const t = $(node).clone().children().remove().end().text().trim();
          if (t.startsWith('₹') && t.length < 15) { priceText = t; return false; }
        });
      }
      if (!priceText) return;

      // Image
      const imgEl = $el.find('img').first();
      let image = imgEl.attr('data-srcset') || imgEl.attr('src') || '';
      if (image.includes(',')) image = image.split(',')[0].trim().split(' ')[0];
      if (!image || image.startsWith('data:')) {
        image = imgEl.attr('data-src') || imgEl.attr('data-lazy') || '';
      }
      if (image && !image.startsWith('http')) image = this.baseUrl + image;

      // Rating & Reviews
      const ratingText = $el.find(
        '.sp__rating, .rating-badge, .star-rating, span[class*="rating"]'
      ).first().text().trim();
      const reviewText = $el.find(
        '.sp__rating-count, .review-count, span[class*="count"]'
      ).first().text().trim();

      // Availability
      const oos = $el.find('[class*="out-of-stock"],[class*="outOfStock"],[class*="sold-out"]').length > 0
        || $el.text().toLowerCase().includes('out of stock');
      const availability = oos ? 'Out of Stock' : 'In Stock';

      // Link
      let link = $el.find('a[href*="/p/"]').first().attr('href')
        || $el.find('a').first().attr('href')
        || titleEl.closest('a').attr('href') || '';
      if (link && !link.startsWith('http')) link = this.baseUrl + (link.startsWith('/') ? '' : '/') + link;
      if (link) link = link.split('?')[0];

      results.push({ rawTitle, priceText, image, ratingText, reviewText, link, availability });
    });

    this.logger.debug(`[Reliance Digital] Parsed ${results.length} raw items from HTML`);
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
      normalizedTitle: normalizeRelianceTitle(title),
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

module.exports = RelianceScraper;
