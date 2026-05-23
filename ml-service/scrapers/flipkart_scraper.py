import logging
import urllib.parse
from bs4 import BeautifulSoup
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)

class FlipkartScraper(BaseScraper):
    def __init__(self, proxy=None):
        super().__init__(base_url="https://www.flipkart.com", proxy=proxy)

    def _extract_price(self, text):
        """Extract numeric price from text like '₹14,999'"""
        if not text: return 0
        cleaned = "".join(c for c in text if c.isdigit() or c == '.')
        try:
            return float(cleaned) if cleaned else 0
        except ValueError:
            return 0

    async def search(self, query, pages=2):
        """
        Search Flipkart using Playwright to render the page, 
        and BeautifulSoup to parse the extracted HTML.
        """
        results = []
        encoded_query = urllib.parse.quote_plus(query)
        
        for page_num in range(1, pages + 1):
            url = f"{self.base_url}/search?q={encoded_query}&page={page_num}"
            logger.info(f"Scraping Flipkart page {page_num}: {url}")
            
            html = await self.fetch_page_html(url)
            if not html:
                logger.warning(f"Failed to fetch HTML for page {page_num}")
                continue
                
            soup = BeautifulSoup(html, 'lxml')
            
            # Check for Captcha even with Playwright
            if "captcha" in soup.text.lower() or "verify you are human" in soup.text.lower():
                logger.error(f"Playwright hit a CAPTCHA at page {page_num}!")
                break # Stop paginating if we hit a captcha
            
            # Flipkart has different class structures depending on the product category.
            # Containers: _1AtVbE, _75nlfW (new), cPHDOP (newest)
            items = soup.find_all('div', attrs={'class': lambda e: e and ('_75nlfW' in e or 'cPHDOP' in e or '_1AtVbE' in e)})
            
            page_results = []
            for item in items:
                link_tag = item.find('a', class_=lambda c: c and ('CGtC98' in c or 'VJA3hP' in c or '_1fQZEK' in c or 'IRpwTa' in c or 'WKTcLC' in c))
                if not link_tag: continue
                    
                link = self.base_url + link_tag.get('href', '')
                
                title_tag = item.find('div', class_=lambda c: c and 'KzDlHZ' in c)
                if not title_tag:
                    title_tag = item.find('a', class_=lambda c: c and ('IRpwTa' in c or 'WKTcLC' in c))
                
                title = title_tag.text.strip() if title_tag else ""
                if not title or len(title) < 3: continue
                    
                brand_tag = item.find('div', class_=lambda c: c and 'syl9yP' in c)
                brand = brand_tag.text.strip() if brand_tag else ""
                if brand and not title.lower().startswith(brand.lower()):
                    title = f"{brand} {title}"

                price_tag = item.find('div', class_=lambda c: c and ('Nx9bqj' in c or '_30jeq3' in c))
                price = self._extract_price(price_tag.text) if price_tag else 0
                if price == 0: continue

                original_price_tag = item.find('div', class_=lambda c: c and ('yRaY8j' in c or '_3I9_wc' in c))
                original_price = self._extract_price(original_price_tag.text) if original_price_tag else price

                discount = 0
                if original_price > price:
                    discount = round(((original_price - price) / original_price) * 100)

                img_tag = item.find('img', class_=lambda c: c and ('DByuf4' in c or '_396cs4' in c))
                image = img_tag.get('src', '') if img_tag else ""
                
                rating_tag = item.find('div', class_=lambda c: c and ('XQDdHH' in c or '_3LWZlK' in c))
                rating = 0.0
                if rating_tag:
                    try: rating = float(rating_tag.text.strip()[:3])
                    except ValueError: pass
                
                review_tag = item.find('span', class_=lambda c: c and ('Wphh3N' in c or '_2_R_DZ' in c))
                review_count = 0
                if review_tag:
                    txt = review_tag.text.strip().split(' ')[0]
                    review_count = int(self._extract_price(txt))
                    
                oos_tag = item.find('div', string=lambda s: s and 'Out of stock' in s)
                availability = "out_of_stock" if oos_tag else "in_stock"

                product_data = {
                    "platform": "flipkart",
                    "title": title,
                    "brand": brand,
                    "price": price,
                    "originalPrice": original_price,
                    "discount": discount,
                    "currency": "INR",
                    "image": image,
                    "link": link,
                    "rating": rating,
                    "reviewCount": review_count,
                    "availability": availability
                }
                
                if not any(p['link'] == link for p in page_results):
                    page_results.append(product_data)
                    
            logger.info(f"Found {len(page_results)} items on page {page_num}")
            results.extend(page_results)
            if not page_results: break
                
        return results

# Expose async function
async def scrape_flipkart_async(query, pages=2):
    scraper = FlipkartScraper()
    return await scraper.search(query, pages=pages)
