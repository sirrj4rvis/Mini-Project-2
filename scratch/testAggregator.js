const { aggregateSearch } = require('../server/src/services/aggregator/aggregator.js');

async function test() {
  console.log('Testing end-to-end aggregation for: cheap gaming mouse');
  try {
    const result = await aggregateSearch('cheap gaming mouse');
    console.log('\n--- SUCCESS ---');
    console.log('Total Items:', result.totalItems);
    console.log('Execution Time (ms):', result.executionTimeMs);
    console.log('Source:', result.source);
    
    if (result.results && result.results.length > 0) {
      console.log('\nTop 3 Results:');
      const top3 = result.results.slice(0, 3);
      top3.forEach((item, idx) => {
        console.log(`\n[${idx + 1}] ${item.canonicalTitle || item.title}`);
        console.log(`    Deal Score: ${item.dealScore}/100`);
        console.log(`    Best Price: ${item.price} ${item.currency}`);
        console.log(`    Brand: ${item.brand || 'Unknown'}`);
      });
    } else {
      console.log('No results found.');
    }
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

test();
