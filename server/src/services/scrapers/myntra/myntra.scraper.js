/**
 * Myntra Scraper — Playwright Edition (Hardened v3)
 * 
 * Uses the shared BrowserFactory for all browser lifecycle management,
 * stealth injection, and context hardening. This scraper focuses solely
 * on Myntra-specific navigation logic and data extraction.
 */

const BrowserFactory = require('../../shared/browserFactory');
const ScraperBase = require('../../shared/scraperBase');
const logger = require('../../shared/logger');
const DelayManager = require('../../antiblock/delayManager');
const RateLimiter = require('../../antiblock/rateLimiter');
const RetryStrategy = require('../../antiblock/retryStrategy');
const {
  normalizeMyntraTitle,
  parsePrice,
  parseRating,
  parseReviewCount,
  determineCategory
} = require('./myntra.normalizer');

class MyntraScraper extends ScraperBase {
  constructor() {
    super({ sourceName: 'Myntra', timeout: 40000 });
    this.baseUrl = 'https://www.myntra.com';
  }

  /**
   * Correct search endpoint: /search?q= triggers the full ElasticSearch index.
   * The old /{slug} route only matches exact Myntra category names.
   */
  buildSearchUrl(query) {
    const encoded = encodeURIComponent(query.trim());
    return `${this.baseUrl}/search?q=${encoded}&searchType=autosuggest&rawQuery=${encoded}`;
  }

  async search(query) {
    this.logger.info(`Starting search for: "${query}"`);
    let context = null;
    let page = null;

    try {
      const extracted = await RetryStrategy.execute(async () => {
        await RateLimiter.throttle('myntra.com', 3500);

        // ── 1. Hardened context from factory (stealth scripts pre-injected) ──
        context = await BrowserFactory.createHardenedContext({
          extraHTTPHeaders: {
            'Referer': 'https://www.myntra.com/'
          }
        });

        // ── 2. Page with resource blocking from factory ──
        page = await BrowserFactory.createPage(context);

        const url = this.buildSearchUrl(query);
        await DelayManager.randomSleep(500, 1200);

        // ── 3. Navigate with 'domcontentloaded' ──
        // 'networkidle' never fires on Myntra — Cloudflare and analytics workers
        // keep persistent background XHR connections alive indefinitely.
        let response;
        try {
          response = await page.goto(url, {
            waitUntil: 'commit',
            timeout: 30000
          });
        } catch (navError) {
          const msg = navError.message.toLowerCase();
          if (msg.includes('http2') || msg.includes('protocol_error') || msg.includes('err_http2')) {
            throw new Error(`HTTP/2 error on Myntra CDN edge: ${navError.message}`);
          }
          throw navError;
        }

        // ── 4. Bot/block detection ──
        const status = response ? response.status() : 0;
        if (status === 403) throw new Error('Blocked by Myntra WAF (403 Forbidden).');
        if (status === 429) throw new Error('Rate limited by Myntra (429). Backing off.');

        // Cloudflare challenge returns 200 with a JS challenge page
        const bodySnippet = await page.evaluate(() =>
          document.body?.innerText?.substring(0, 300) || ''
        ).catch(() => '');
        if (
          bodySnippet.toLowerCase().includes('checking your browser') ||
          bodySnippet.toLowerCase().includes('just a moment')
        ) {
          throw new Error('Cloudflare JS challenge detected. Session blocked.');
        }

        // ── 5. Wait for product grid to render ──
        const productSelector = [
          'li.product-base',
          'li[class*="product-base"]',
          'div[class*="product-base"]',
          'div[class*="SearchResults"]',
          'div[data-testid="product-card"]'
        ].join(', ');

        const appeared = await page.waitForSelector(productSelector, {
          state: 'attached',
          timeout: 18000
        }).catch(() => null);

        if (!appeared) {
          const title = await page.title().catch(() => 'unknown');
          this.logger.warn(`[Myntra] Products not found. Page title: "${title}". Retrying...`);
          throw new Error('Product selector not found — DOM may have changed or request is blocked.');
        }

        // ── 6. Scroll to trigger lazy-loaded cards below the fold ──
        await DelayManager.microDelay();
        await page.evaluate(() => window.scrollBy(0, 700)).catch(() => {});
        await DelayManager.randomSleep(600, 1200);

        // ── 7. Extract product data ──
        const data = await page.$$eval([
          'li.product-base',
          'li[class*="product-base"]',
          'div[class*="product-base"]'
        ].join(', '), (elements) => {
          return elements.slice(0, 40).map(el => {
            const brandEl =
              el.querySelector('h3.product-brand') ||
              el.querySelector('h3[class*="brand"]');
            const titleEl =
              el.querySelector('h4.product-product') ||
              el.querySelector('h4[class*="product"]') ||
              el.querySelector('h4');
            const priceEl =
              el.querySelector('span.product-discountedPrice') ||
              el.querySelector('span[class*="discountedPrice"]') ||
              el.querySelector('span[class*="discounted"]') ||
              el.querySelector('.product-price span') ||
              el.querySelector('span[class*="price"]') ||
              el.querySelector('div[class*="price"]');
            const imgEl =
              el.querySelector('picture img') ||
              el.querySelector('img[class*="product"]') ||
              el.querySelector('img');
            const ratingEl =
              el.querySelector('.product-ratingsContainer span') ||
              el.querySelector('span[class*="ratingsContainer"] span') ||
              el.querySelector('span[class*="rating"]');
            const reviewEl =
              el.querySelector('.product-ratingsCount') ||
              el.querySelector('span[class*="ratingsCount"]') ||
              el.querySelector('span[class*="review"]');
            const linkEl = el.querySelector('a[href*="/buy"], a[href]');

            let imgSrc = '';
            if (imgEl) {
              const srcset = imgEl.getAttribute('srcset');
              imgSrc = (srcset ? srcset.split(',')[0].trim().split(' ')[0] : '')
                || imgEl.getAttribute('data-src')
                || imgEl.getAttribute('src')
                || '';
            }

            const oosEl = el.querySelector(
              '[class*="out-of-stock"], [class*="outOfStock"], [class*="sold-out"]'
            );

            return {
              brand: brandEl ? brandEl.innerText.trim() : '',
              rawTitle: titleEl ? titleEl.innerText.trim() : '',
              priceText: priceEl ? priceEl.innerText.trim() : '',
              image: imgSrc,
              ratingText: ratingEl ? ratingEl.innerText.trim() : '',
              reviewText: reviewEl ? reviewEl.innerText.trim() : '',
              link: linkEl ? linkEl.getAttribute('href') : '',
              availability: oosEl ? 'Out of Stock' : 'In Stock'
            };
          }).filter(item => item.rawTitle.length > 0);
        }).catch(() => []);


        if (!data || data.length === 0) {
          throw new Error('No products extracted — DOM structure may have changed.');
        }

        return data;

      }, {
        context: `Myntra Playwright [${query}]`,
        maxRetries: 2,
        baseDelayMs: 3500,
        isPlaywright: true
      });

      const normalizedProducts = extracted.map(item => {
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

  async extractData(html) { return []; }

  normalizeProduct(rawProduct) {
    const fullTitle = rawProduct.brand
      ? `${rawProduct.brand} ${rawProduct.rawTitle}`
      : rawProduct.rawTitle;
    const price = parsePrice(rawProduct.priceText);

    if (!rawProduct.rawTitle || price <= 0) {
      throw new Error('Invalid or missing essential data');
    }

    let link = rawProduct.link;
    if (link && !link.startsWith('http')) {
      link = `${this.baseUrl}/${link.replace(/^\//, '')}`;
    }

    return {
      title: fullTitle,
      normalizedTitle: normalizeMyntraTitle(rawProduct.rawTitle, rawProduct.brand),
      price,
      currency: 'INR',
      image: rawProduct.image || '',
      rating: parseRating(rawProduct.ratingText),
      reviewCount: parseReviewCount(rawProduct.reviewText),
      source: this.sourceName,
      category: determineCategory(fullTitle),
      availability: rawProduct.availability || 'In Stock',
      link: link || '',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = MyntraScraper;
