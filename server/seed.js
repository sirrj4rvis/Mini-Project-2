/**
 * Database Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-populates MongoDB with Indian electronics products so the platform
 * works immediately — without waiting for external API approvals.
 *
 * Run once:  node seed.js
 */

// Node v24 DNS Fix
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const PriceHistory = require('./src/models/PriceHistory');
const User = require('./src/models/User');

const MONGO_URI = process.env.MONGO_URI;

const PRODUCTS = [
  {
    title: 'Apple MacBook Air M2 (2023) 8GB 256GB',
    brand: 'Apple', category: 'Laptops',
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
    description: 'Apple MacBook Air with M2 chip, 13.6-inch Liquid Retina display, 18-hour battery',
    searchKeywords: ['macbook', 'apple', 'laptop', 'm2', 'macbook air'],
    sources: [
      { platform: 'amazon', price: 114900, originalPrice: 119900, discount: 4, currency: 'INR', link: 'https://www.amazon.in/s?k=MacBook+Air+M2', availability: 'in_stock', rating: 4.8, reviewCount: 2341, seller: 'Amazon.in' },
      { platform: 'ebay', price: 116500, originalPrice: 119900, discount: 3, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=MacBook+Air+M2', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'Samsung Galaxy S24 Ultra 12GB/256GB Titanium Black',
    brand: 'Samsung', category: 'Smartphones',
    imageUrl: 'https://m.media-amazon.com/images/I/71Sa3dqTqzL._SX342_.jpg',
    description: 'Galaxy S24 Ultra with Snapdragon 8 Gen 3, 200MP camera, built-in S Pen',
    searchKeywords: ['samsung', 'galaxy', 's24', 'ultra', 'smartphone', 'android'],
    sources: [
      { platform: 'amazon', price: 124999, originalPrice: 134999, discount: 7, currency: 'INR', link: 'https://www.amazon.in/s?k=Samsung+Galaxy+S24+Ultra', availability: 'in_stock', rating: 4.6, reviewCount: 3421, seller: 'Samsung India' },
      { platform: 'ebay', price: 127500, originalPrice: 134999, discount: 6, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=Samsung+Galaxy+S24+Ultra', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'Apple iPhone 15 Pro 128GB Natural Titanium',
    brand: 'Apple', category: 'Smartphones',
    imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80',
    description: 'iPhone 15 Pro with A17 Pro chip, titanium design, 48MP camera system',
    searchKeywords: ['iphone', 'apple', '15 pro', 'smartphone', 'ios'],
    sources: [
      { platform: 'amazon', price: 134900, originalPrice: 139900, discount: 4, currency: 'INR', link: 'https://www.amazon.in/s?k=iPhone+15+Pro', availability: 'in_stock', rating: 4.8, reviewCount: 5102, seller: 'Apple India' },
      { platform: 'ebay', price: 136000, originalPrice: 139900, discount: 3, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=iPhone+15+Pro', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    brand: 'Sony', category: 'Audio',
    imageUrl: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80',
    description: 'Industry-leading noise cancellation, 30-hour battery, Multipoint connection',
    searchKeywords: ['sony', 'headphone', 'noise cancelling', 'wireless', 'xm5'],
    sources: [
      { platform: 'amazon', price: 26990, originalPrice: 34990, discount: 23, currency: 'INR', link: 'https://www.amazon.in/s?k=Sony+WH-1000XM5', availability: 'in_stock', rating: 4.7, reviewCount: 3201, seller: 'Sony India' },
      { platform: 'ebay', price: 27500, originalPrice: 34990, discount: 21, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=Sony+WH1000XM5', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'OnePlus 12 5G 16GB/512GB Silky Black',
    brand: 'OnePlus', category: 'Smartphones',
    imageUrl: 'https://images.unsplash.com/photo-1678911820864-e4c567cab6c5?w=800&q=80',
    description: 'OnePlus 12 with Snapdragon 8 Gen 3, 50MP Hasselblad camera, 100W charging',
    searchKeywords: ['oneplus', '12', 'smartphone', '5g', 'android'],
    sources: [
      { platform: 'amazon', price: 64999, originalPrice: 69999, discount: 7, currency: 'INR', link: 'https://www.amazon.in/s?k=OnePlus+12', availability: 'in_stock', rating: 4.4, reviewCount: 2109, seller: 'OnePlus India' },
      { platform: 'ebay', price: 66000, originalPrice: 69999, discount: 6, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=OnePlus+12', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'ASUS ROG Strix G15 Gaming Laptop RTX 4060',
    brand: 'ASUS', category: 'Laptops',
    imageUrl: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80',
    description: 'AMD Ryzen 9, 16GB RAM, 512GB SSD, RTX 4060, 165Hz display',
    searchKeywords: ['asus', 'rog', 'gaming laptop', 'rtx', 'strix'],
    sources: [
      { platform: 'amazon', price: 89990, originalPrice: 104990, discount: 14, currency: 'INR', link: 'https://www.amazon.in/s?k=ASUS+ROG+Strix+G15', availability: 'in_stock', rating: 4.4, reviewCount: 876, seller: 'ASUS India' },
      { platform: 'ebay', price: 91000, originalPrice: 104990, discount: 13, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=ASUS+ROG+Strix+G15', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'LG C3 55 inch OLED evo 4K Smart TV',
    brand: 'LG', category: 'TVs',
    imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
    description: 'OLED evo panel, α9 AI Processor 4K Gen6, Dolby Vision IQ & Atmos',
    searchKeywords: ['lg', 'oled', 'tv', '4k', 'c3', 'smart tv'],
    sources: [
      { platform: 'amazon', price: 109990, originalPrice: 134990, discount: 19, currency: 'INR', link: 'https://www.amazon.in/s?k=LG+C3+OLED', availability: 'in_stock', rating: 4.7, reviewCount: 1203, seller: 'LG India' },
      { platform: 'ebay', price: 112000, originalPrice: 134990, discount: 17, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=LG+C3+OLED+TV', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
  {
    title: 'Redmi Note 13 Pro+ 5G 8GB/256GB Midnight Black',
    brand: 'Xiaomi', category: 'Smartphones',
    imageUrl: 'https://images.unsplash.com/photo-1601784551446-20c9e07cd56e?w=800&q=80',
    description: '200MP OIS camera, MediaTek Dimensity 7200 Ultra, 120W HyperCharge',
    searchKeywords: ['redmi', 'note', '13 pro', 'xiaomi', 'smartphone'],
    sources: [
      { platform: 'amazon', price: 31999, originalPrice: 35999, discount: 11, currency: 'INR', link: 'https://www.amazon.in/s?k=Redmi+Note+13+Pro+Plus', availability: 'in_stock', rating: 4.3, reviewCount: 4302, seller: 'Xiaomi India' },
      { platform: 'ebay', price: 32500, originalPrice: 35999, discount: 10, currency: 'INR', link: 'https://www.ebay.in/sch/i.html?_nkw=Redmi+Note+13+Pro+Plus', availability: 'in_stock', rating: 0, reviewCount: 0, seller: 'eBay IN' },
    ],
  },
];

const generatePriceHistory = (productId, sources) => {
  const history = [];
  const now = new Date();
  for (const source of sources) {
    // Generate 90 days of price history with realistic fluctuations
    for (let d = 89; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const fluctuation = 0.95 + Math.random() * 0.1; // ±5%
      history.push({
        productId,
        platform: source.platform,
        price: Math.round(source.price * fluctuation),
        originalPrice: source.originalPrice,
        currency: source.currency,
        availability: source.availability,
        timestamp: date,
      });
    }
  }
  return history;
};

const seed = async () => {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected!\n');

    // Create admin test user if not exists
    const adminExists = await User.findOne({ email: 'admin@pricelens.in' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@pricelens.in',
        password: 'PriceLens#Admin9',
        role: 'admin',
      });
      console.log('✅ Test admin created: admin@pricelens.in / Admin@1234');
    }

    // Create test regular user
    const userExists = await User.findOne({ email: 'test@pricelens.in' });
    if (!userExists) {
      await User.create({
        name: 'Test User',
        email: 'test@pricelens.in',
        password: 'PriceLens#User9',
        role: 'user',
      });
      console.log('✅ Test user created: test@pricelens.in / Test@1234');
    }

    console.log('\n🌱 Seeding products...');
    let seeded = 0;

    for (const p of PRODUCTS) {
      const prices = p.sources.map((s) => s.price);
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);
      const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const bestSource = p.sources.reduce((prev, curr) => (prev.price < curr.price ? prev : curr));

      const doc = await Product.findOneAndUpdate(
        { normalizedTitle: p.title.toLowerCase().trim() },
        {
          $set: {
            ...p,
            normalizedTitle: p.title.toLowerCase().trim(),
            lowestPrice,
            highestPrice,
            averagePrice,
            bestDealPlatform: bestSource.platform,
            searchCount: Math.floor(Math.random() * 500) + 10,
            lastScrapedAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      // Generate 90 days of price history
      const historyDocs = generatePriceHistory(doc._id, p.sources);
      await PriceHistory.insertMany(historyDocs, { ordered: false });

      console.log(`  ✅ ${p.title.slice(0, 50)}`);
      seeded++;
    }

    console.log(`\n🎉 Done! Seeded ${seeded} products with 90-day price history.`);
    console.log('\n📋 Test Credentials:');
    console.log('   Admin: admin@pricelens.in  /  PriceLens#Admin9');
    console.log('   User:  test@pricelens.in   /  PriceLens#User9');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('querySrv')) {
      console.log('\n⚠️  MongoDB Atlas is blocking your IP address!');
      console.log('   Fix: Go to MongoDB Atlas → Network Access → Add IP Address → Add Current IP');
    }
    process.exit(1);
  }
};

seed();
