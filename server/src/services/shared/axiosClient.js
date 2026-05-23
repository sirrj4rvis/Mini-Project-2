const axios = require('axios');
const http = require('http');
const https = require('https');
const UserAgentRotator = require('../antiblock/userAgentRotator');
const RetryStrategy = require('../antiblock/retryStrategy');

// Shared agents to reuse TCP connections across scraping requests (improves performance)
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

/**
 * Factory to create a specialized Axios client for scraping.
 * Integrates dynamic header rotation and automatic retry logic.
 */
const createScraperClient = (options = {}) => {
  const instance = axios.create({
    timeout: options.timeout || 20000,
    httpAgent,
    httpsAgent,
    maxRedirects: 5,
    ...options
  });

  // Interceptor to inject fresh rotating headers on every request
  instance.interceptors.request.use((config) => {
    config.headers = {
      ...UserAgentRotator.getRealisticHeaders(),
      ...config.headers
    };
    return config;
  });

  // Return an adapter object that wraps axios calls in our advanced retry engine
  return {
    get: async (url, config = {}) => {
      return RetryStrategy.execute(() => instance.get(url, config), {
        context: `GET ${url}`,
        maxRetries: config.maxRetries || 3,
        baseDelayMs: 2000,
        isPlaywright: false
      });
    },
    post: async (url, data, config = {}) => {
      return RetryStrategy.execute(() => instance.post(url, data, config), {
        context: `POST ${url}`,
        maxRetries: config.maxRetries || 3,
        baseDelayMs: 2000,
        isPlaywright: false
      });
    },
    // Expose raw instance for advanced/custom handling bypassing retries if needed
    raw: instance
  };
};

module.exports = { createScraperClient };
