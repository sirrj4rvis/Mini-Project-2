/**
 * Standard delay function.
 * @param {number} ms 
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Adds a random delay between min and max milliseconds.
 * Crucial for respectful scraping to mimic human behavior.
 */
const randomDelay = (min = 1000, max = 3000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(ms);
};

/**
 * Wraps a promise with a hard timeout.
 * @param {Promise} promise 
 * @param {number} timeoutMs 
 * @param {any} fallback - Optional fallback value if timeout occurs instead of throwing.
 */
const withTimeout = (promise, timeoutMs, fallback = null) => {
  // CRITICAL FIX: Attach a silent no-op rejection sink to the original promise.
  // When the timeout race wins, the original promise becomes orphaned and continues
  // running in the background. If it later rejects (e.g. network disconnect), Node.js
  // v15+ will throw an UnhandledPromiseRejection and CRASH the entire process.
  // This sink absorbs the late error without masking it from the race winner.
  promise.catch(() => {});

  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutHandle);
  }).catch(err => {
    if (fallback !== null) return fallback;
    throw err;
  });
};

module.exports = { delay, randomDelay, withTimeout };
