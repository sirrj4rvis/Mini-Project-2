const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.USD_TO_INR = '9.43';

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Product = require('../src/models/Product');

// Mock the Amazon API Service
jest.mock('../src/services/amazonApiService', () => ({
  searchAmazonProducts: jest.fn().mockResolvedValue([
    {
      asin: 'B0CXXXXX',
      title: 'Test Amazon Product',
      product_price: 199.99,
      currency: 'USD',
      product_url: 'https://amazon.com/dp/B0CXXXXX',
      product_photo: 'https://example.com/photo.jpg',
      is_prime: true,
      product_star_rating: 4.5,
      product_num_ratings: 100
    }
  ]),
  getAmazonProductDetails: jest.fn().mockResolvedValue({
    asin: 'B0CXXXXX',
    title: 'Test Amazon Product',
    product_description: 'Test description',
    price: 199.99,
    currency: 'USD',
  })
}));

// Mock the eBay API Service
jest.mock('../src/services/ebayApiService', () => ({
  searchEbayProducts: jest.fn().mockResolvedValue([
    {
      title: 'Test Amazon Product', // Match title for merging
      price: { value: 189.99, currency: 'USD' },
      itemWebUrl: 'https://ebay.com/itm/12345',
      image: { imageUrl: 'https://example.com/photo.jpg' },
      conditionId: '1000'
    }
  ])
}));

// Mock Currency Service
jest.mock('../src/services/currencyService', () => ({
  getUsdToInrRate: jest.fn().mockResolvedValue(83),
}));



beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});

afterEach(async () => {
  await Product.deleteMany({});
  jest.clearAllMocks();
});

describe('Product API Endpoints', () => {
  
  describe('GET /api/products/search', () => {
    it('should search products and return normalized results', async () => {
      const res = await request(app).get('/api/products/search?q=test');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBeGreaterThan(0);
      
      const product = res.body.products[0];
      expect(product.title).toBe('Test Amazon Product');
      // Should find the lowest INR-converted price between Amazon and eBay.
      expect(product.price).toBe(Math.round(189.99 * 83)); 
      expect(product.storeCount).toBe(2);
    });
    
    it('should return 422 if query is missing', async () => {
      const res = await request(app).get('/api/products/search');
      
      expect(res.statusCode).toEqual(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });
  });

});
