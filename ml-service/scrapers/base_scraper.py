import logging
import asyncio
from typing import Optional
from playwright.async_api import async_playwright, Browser, BrowserContext

logger = logging.getLogger(__name__)

class PlaywrightManager:
    """
    Singleton manager for the Playwright browser instance.
    Keeps a single browser open to reduce overhead across multiple scrape requests.
    """
    _instance = None
    _browser: Optional[Browser] = None
    _playwright = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PlaywrightManager, cls).__new__(cls)
        return cls._instance

    async def get_browser(self, proxy: Optional[str] = None) -> Browser:
        """Initialize or return the existing browser instance."""
        if not self._playwright:
            self._playwright = await async_playwright().start()
            
        if not self._browser:
            logger.info("Starting new Playwright Chromium instance...")
            # We run headful or headless depending on needs.
            # Headless is required for Docker/production.
            launch_args = {
                "headless": True,
                "args": [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
            if proxy:
                launch_args["proxy"] = {"server": proxy}
                
            self._browser = await self._playwright.chromium.launch(**launch_args)
            
        return self._browser

    async def create_context(self, proxy: Optional[str] = None) -> BrowserContext:
        """Create an isolated incognito browser context."""
        browser = await self.get_browser(proxy)
        
        from .user_agents import get_random_user_agent
        user_agent = get_random_user_agent()
        
        context = await browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1920, "height": 1080},
            ignore_https_errors=True,
            java_script_enabled=True,
            has_touch=False
        )
        
        # Inject stealth scripts into every new page
        await context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            window.chrome = {
                runtime: {}
            };
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            """
        )
        return context

    async def cleanup(self):
        """Close browser and stop Playwright."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

# Global instance
browser_manager = PlaywrightManager()

class BaseScraper:
    """
    Base scraper class using Playwright.
    """
    def __init__(self, base_url: str, proxy: Optional[str] = None):
        self.base_url = base_url
        self.proxy = proxy
        
    async def fetch_page_html(self, url: str) -> Optional[str]:
        """
        Loads the page using Playwright, waits for content to render,
        and returns the HTML string for BeautifulSoup parsing.
        """
        context = await browser_manager.create_context(self.proxy)
        page = await context.new_page()
        
        # Apply playwright-stealth if available
        try:
            from playwright_stealth import stealth_async
            await stealth_async(page)
        except ImportError:
            logger.warning("playwright-stealth not found, continuing without it.")

        html_content = None
        try:
            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # Simulate human behavior
            await self._simulate_human_behavior(page)
            
            # Extract HTML
            html_content = await page.content()
            
        except Exception as e:
            logger.error(f"Failed to fetch {url} via Playwright: {e}")
        finally:
            await page.close()
            await context.close()
            
        return html_content

    async def _simulate_human_behavior(self, page):
        """Randomized scrolling and mouse movements to evade bot detection."""
        import random
        import asyncio
        
        # Random initial delay
        await asyncio.sleep(random.uniform(1.0, 2.5))
        
        # Scroll down randomly
        scroll_steps = random.randint(2, 5)
        for _ in range(scroll_steps):
            scroll_y = random.randint(300, 800)
            await page.mouse.wheel(0, scroll_y)
            await asyncio.sleep(random.uniform(0.5, 1.5))
            
            # Random mouse movements
            x = random.randint(100, 1000)
            y = random.randint(100, 800)
            await page.mouse.move(x, y)
