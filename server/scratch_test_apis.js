require('dotenv').config({ path: './.env' });
const { searchAmazonProducts, getProductByAsin } = require('./src/services/amazonApiService');
const { searchEbayProducts } = require('./src/services/ebayApiService');
const { searchWalmartProducts, getWalmartRollbacks } = require('./src/services/walmartApiService');

async function testAPIs() {
  console.log('--- TESTING AMAZON API ---');
  try {
    const amz = await searchAmazonProducts('laptop', 1);
    console.log(`Amazon search returned ${amz.length} results.`);
    if (amz.length > 0) {
      console.log('Amazon first result keys:', Object.keys(amz[0]));
    }
  } catch (err) {
    console.error('Amazon search failed:', err.message);
  }

  console.log('\n--- TESTING EBAY API ---');
  try {
    const ebay = await searchEbayProducts('laptop', 5, 1);
    console.log(`eBay search returned ${ebay.length} results.`);
    if (ebay.length > 0) {
      console.log('eBay first result keys:', Object.keys(ebay[0]));
    }
  } catch (err) {
    console.error('eBay search failed:', err.message);
    if (err.response) console.error('Response data:', err.response.data);
  }

  console.log('\n--- TESTING WALMART API ---');
  try {
    const walmart = await searchWalmartProducts('laptop', 1);
    console.log(`Walmart search returned ${walmart.length} results.`);
    if (walmart.length > 0) {
      console.log('Walmart first result keys:', Object.keys(walmart[0]));
    }
  } catch (err) {
    console.error('Walmart search failed:', err.message);
    if (err.response) console.error('Response data:', err.response.data);
  }

  console.log('\n--- TESTING WALMART ROLLBACKS ---');
  try {
    const rollbacks = await getWalmartRollbacks(1);
    console.log(`Walmart rollbacks returned ${rollbacks.length} results.`);
  } catch (err) {
    console.error('Walmart rollbacks failed:', err.message);
  }
}

testAPIs();
