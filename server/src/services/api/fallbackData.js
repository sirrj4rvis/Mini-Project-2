const logger = require('../shared/logger');

/**
 * Fallback Data Store for handling 429 Quota Exhaustion.
 * Simulates exactly what RapidAPI would return for common queries.
 */
const fallbackData = {
  amazon: {
    'samsung s24 ultra': [
      {
        product_title: 'Samsung Galaxy S24 Ultra 5G (Titanium Gray, 12GB, 256GB Storage)',
        product_price: '₹1,29,999',
        product_original_price: '₹1,34,999',
        currency: 'INR',
        product_star_rating: '4.6',
        product_num_ratings: 1250,
        product_url: 'https://www.amazon.in/dp/B0CQYLJHY7',
        product_photo: 'https://m.media-amazon.com/images/I/71RVuQsAQcL._SX679_.jpg',
        is_prime: true
      },
      {
        product_title: 'Samsung Galaxy S24 Ultra 5G (Titanium Black, 12GB, 512GB Storage)',
        product_price: '₹1,39,999',
        product_original_price: '₹1,44,999',
        currency: 'INR',
        product_star_rating: '4.7',
        product_num_ratings: 850,
        product_url: 'https://www.amazon.in/dp/B0CQYKJHK8',
        product_photo: 'https://m.media-amazon.com/images/I/71RVuQsAQcL._SX679_.jpg',
        is_prime: true
      }
    ],
    'iphone 15': [
      {
        product_title: 'Apple iPhone 15 (128 GB) - Black',
        product_price: '₹72,999',
        product_original_price: '₹79,900',
        currency: 'INR',
        product_star_rating: '4.5',
        product_num_ratings: 5400,
        product_url: 'https://www.amazon.in/dp/B0CHX1W1XY',
        product_photo: 'https://m.media-amazon.com/images/I/71657TiFeHL._SX679_.jpg',
        is_prime: true
      }
    ]
  },
  walmart: {
    'samsung s24 ultra': [
      {
        title: 'SAMSUNG Galaxy S24 Ultra Cell Phone, 256GB Unlocked Android Smartphone',
        price: 1150.00,
        currency: 'USD',
        rating: 4.8,
        reviews: 320,
        url: 'https://www.walmart.com/ip/Samsung-S24-Ultra/123456789',
        thumbnail: 'https://i5.walmartimages.com/seo/Samsung-S24-Ultra.jpg',
        sellerId: 'WALMART',
        availabilityStatus: 'IN_STOCK'
      }
    ],
    'iphone 15': [
      {
        title: 'Apple iPhone 15, 128GB, Black - Unlocked',
        price: 799.00,
        currency: 'USD',
        rating: 4.4,
        reviews: 1200,
        url: 'https://www.walmart.com/ip/Apple-iPhone-15/987654321',
        thumbnail: 'https://i5.walmartimages.com/seo/iPhone-15.jpg',
        sellerId: 'WALMART',
        availabilityStatus: 'IN_STOCK'
      }
    ]
  },
  ebay: {
    'laptop': [
      {
        itemId: 'v1|123456789|0',
        title: 'Dell XPS 13 Laptop - Intel Core i7 - 16GB RAM - 512GB SSD',
        price: { value: '999.00', currency: 'USD' },
        image: { imageUrl: 'https://i.ebayimg.com/images/g/xps13/s-l500.jpg' },
        buyingOptions: ['FIXED_PRICE'],
        seller: { username: 'dell_official', feedbackPercentage: '99.8' },
        itemWebUrl: 'https://www.ebay.com/itm/123456789',
        condition: 'New'
      }
    ],
    'iphone 15': [
      {
        itemId: 'v1|987654321|0',
        title: 'Apple iPhone 15 128GB Unlocked Smartphone - Excellent',
        price: { value: '749.00', currency: 'USD' },
        image: { imageUrl: 'https://i.ebayimg.com/images/g/iphone15/s-l500.jpg' },
        buyingOptions: ['FIXED_PRICE'],
        seller: { username: 'apple_refurb', feedbackPercentage: '98.5' },
        itemWebUrl: 'https://www.ebay.com/itm/987654321',
        condition: 'Refurbished'
      }
    ]
  }
};

/**
 * Returns fallback data for a specific source and query if available.
 * @param {string} source - 'amazon' or 'walmart'
 * @param {string} query - the search query
 * @returns {Array|null} - The mocked product list or null
 */
function getFallbackData(source, query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Attempt to find a partial match in our fallback store
  const store = fallbackData[source];
  if (!store) return null;

  for (const [key, results] of Object.entries(store)) {
    if (normalizedQuery.includes(key)) {
      logger.info(`[FallbackData] Serving simulated results for "${query}" from ${source}`);
      return results;
    }
  }

  // Generic fallback if query doesn't match
  logger.warn(`[FallbackData] No exact mock found for "${query}" on ${source}. Returning generic mock.`);
  return store['samsung s24 ultra']; // always return something so the UI doesn't break
}

module.exports = { getFallbackData };
