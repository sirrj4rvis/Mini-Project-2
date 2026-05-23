/**
 * Phase 8 — Stress Test & Performance Benchmark
 * Tests: concurrent load, cache effectiveness, memory growth, retry storm prevention
 */
require('dotenv').config({ path: './.env' });
const { aggregateSearch } = require('./src/services/aggregator/aggregator');
const CacheManager = require('./src/services/cache/cacheManager');

const QUERIES = ['laptop', 'headphones', 'iphone', 'watch', 'tablet'];
const CONCURRENCY = 5; // Simulate 5 concurrent search requests

function memMB() {
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
}

async function runConcurrentBatch(queries, label) {
  const start = Date.now();
  const memBefore = memMB();
  console.log(`\n[${label}] Starting ${queries.length} concurrent requests... Heap: ${memBefore}MB`);

  const results = await Promise.allSettled(queries.map(q => aggregateSearch(q)));

  const elapsed = Date.now() - start;
  const memAfter = memMB();
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed    = results.filter(r => r.status === 'rejected').length;

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const res = r.value;
      console.log(`  ✅ "${queries[i]}" → ${res.totalItems} items | source=${res.source} | ${res.executionTimeMs}ms`);
    } else {
      console.log(`  ❌ "${queries[i]}" → FAILED: ${r.reason?.message}`);
    }
  });

  console.log(`\n[${label}] Done. Succeeded=${succeeded} Failed=${failed} | Elapsed=${elapsed}ms | Heap: ${memBefore}MB → ${memAfter}MB (+${(memAfter - memBefore).toFixed(1)}MB)`);
  return { elapsed, succeeded, failed, memBefore, memAfter };
}

async function main() {
  console.log('=== Phase 8: Performance & Load Stress Test ===\n');
  console.log(`Initial heap: ${memMB()}MB`);

  // Round 1: Cold start — no cache, full scraping
  const round1 = await runConcurrentBatch(QUERIES.slice(0, CONCURRENCY), 'ROUND 1 — COLD (no cache)');
  
  // Brief pause then run same queries — should hit cache
  await new Promise(r => setTimeout(r, 2000));
  
  // Round 2: Warm cache — same queries, expect near-instant responses
  const round2 = await runConcurrentBatch(QUERIES.slice(0, CONCURRENCY), 'ROUND 2 — WARM (cached)');

  // Round 3: Retry storm test — fire same query 10 times simultaneously
  console.log('\n[ROUND 3 — RETRY STORM] Firing "laptop" 10x simultaneously...');
  const stormStart = Date.now();
  const stormResults = await Promise.allSettled(
    Array(10).fill('laptop').map(q => aggregateSearch(q))
  );
  const stormElapsed = Date.now() - stormStart;
  const stormSources = stormResults.map(r => r.value?.source).join(', ');
  console.log(`  All resolved in ${stormElapsed}ms | Sources: ${stormSources}`);
  console.log(`  Heap after storm: ${memMB()}MB`);

  // Summary
  console.log('\n=== BENCHMARK SUMMARY ===');
  console.log(`Cold start avg: ${(round1.elapsed / CONCURRENCY).toFixed(0)}ms per query`);
  console.log(`Cache hit avg:  ${(round2.elapsed / CONCURRENCY).toFixed(0)}ms per query`);
  console.log(`Cache speedup:  ${(round1.elapsed / round2.elapsed).toFixed(1)}x`);
  console.log(`Memory growth:  +${(round2.memAfter - round1.memBefore).toFixed(1)}MB over both rounds`);
  console.log(`Storm (10x concurrent): ${stormElapsed}ms total | Final heap: ${memMB()}MB`);
  
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
