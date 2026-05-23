const winston = require('winston');

const { combine, timestamp, printf, colorize, errors, json, metadata } = winston.format;

// ─── Human-readable format for development console ───────────────────────────
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const context = meta.metadata?.context ? ` [${meta.metadata.context}]` : '';
  return `${timestamp}${context} [${level}]: ${stack || message}`;
});

// ─── Structured JSON format for production log files and log aggregators ─────
// Fields: timestamp, level, message, stack, requestId, context, url, method
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
  format: combine(
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
    }),
    // Structured JSON for log aggregators (ELK, Grafana Loki, etc.)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: prodFormat,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

/**
 * Creates a child logger bound to a specific component context.
 * Usage: const log = logger.child({ context: 'FlipkartScraper', requestId: '...' })
 */
logger.child = (meta) => logger.child(meta);

module.exports = logger;
