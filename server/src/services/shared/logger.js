const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const scraperLogFormat = printf(({ level, message, timestamp, source, stack }) => {
  const sourceTag = source ? `[${source}]` : '[Scraper]';
  return `${timestamp} [${level}] ${sourceTag}: ${stack || message}`;
});

/**
 * Dedicated logger instance for the scraping infrastructure.
 * Ensures scraping noise doesn't flood the main API logs.
 */
const scraperLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    scraperLogFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), scraperLogFormat),
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../../../logs/scraper-error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../../../logs/scraper-combined.log') 
    }),
  ],
});

module.exports = scraperLogger;
