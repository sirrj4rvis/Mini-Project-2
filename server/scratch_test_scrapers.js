require('dotenv').config({ path: './.env' });
const FlipkartScraper = require('./src/services/scrapers/flipkart/flipkart.scraper');
const CromaScraper = require('./src/services/scrapers/croma/croma.scraper');
const RelianceScraper = require('./src/services/scrapers/reliance/reliance.scraper');
const MyntraScraper = require('./src/services/scrapers/myntra/myntra.scraper');

const flipkart = new FlipkartScraper();
const croma = new CromaScraper();
const reliance = new RelianceScraper();
const myntra = new MyntraScraper();

async function testScrapers() {
  console.log('--- TESTING FLIPKART SCRAPER ---');
  try {
    const fkRes = await flipkart.search('laptop');
    console.log(`Flipkart found ${fkRes.length} items`);
    if (fkRes.length > 0) console.log('Sample:', fkRes[0]);
  } catch (err) {
    console.error('Flipkart Error:', err.message);
  }

  console.log('\n--- TESTING CROMA SCRAPER ---');
  try {
    const crRes = await croma.search('laptop');
    console.log(`Croma found ${crRes.length} items`);
    if (crRes.length > 0) console.log('Sample:', crRes[0]);
  } catch (err) {
    console.error('Croma Error:', err.message);
  }

  console.log('\n--- TESTING RELIANCE SCRAPER ---');
  try {
    const relRes = await reliance.search('laptop');
    console.log(`Reliance found ${relRes.length} items`);
    if (relRes.length > 0) console.log('Sample:', relRes[0]);
  } catch (err) {
    console.error('Reliance Error:', err.message);
  }

  console.log('\n--- TESTING MYNTRA SCRAPER ---');
  try {
    const mynRes = await myntra.search('tshirt');
    console.log(`Myntra found ${mynRes.length} items`);
    if (mynRes.length > 0) console.log('Sample:', mynRes[0]);
  } catch (err) {
    console.error('Myntra Error:', err.message);
  }
  
  process.exit(0);
}

testScrapers();
