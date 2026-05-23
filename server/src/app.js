// ── Node v24 + MongoDB Atlas Fix ─────────────────────────────────────────────
// Node v24's DNS resolver fails on Windows for MongoDB SRV records.
// Override to Google's public DNS before any other module loads.
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
// REMOVED: process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// Bug 11 fix: Setting this globally disables TLS verification for ALL outgoing HTTPS
// requests in this process (axios calls, ML bridge, exchange rate API, etc.) — a critical
// MITM vulnerability. The TLS bypass is scoped to MongoDB only via driver options in db.js.
// ─────────────────────────────────────────────────────────────────────────────

const crypto  = require('crypto');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { connectDB }                     = require('./config/db');
const { validateEnv }                   = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { globalLimiter }                 = require('./middleware/rateLimiter');
const logger = require('./config/logger');

// ─── Global Process Safety Nets ─────────────────────────────────────────────
// Winston's rejectionHandlers covers most cases, but these explicit handlers
// provide a final safety net and allow graceful shutdown logging.
process.on('uncaughtException', (err) => {
  logger.error('[Process] Uncaught Exception — shutting down', { stack: err.stack });
  // Give the logger time to flush before process manager (PM2) restarts.
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.stack : String(reason);
  logger.error(`[Process] Unhandled Promise Rejection: ${msg}`);
  // Do NOT exit — Winston rejectionHandlers already logged it; server stays up.
});

// Route imports
const authRoutes    = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const alertRoutes   = require('./routes/alertRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const forumRoutes   = require('./routes/forumRoutes');
const mlRoutes      = require('./routes/mlRoutes');

// Cron jobs
const { initCronJobs } = require('./jobs/cronJobs');

// Validate all environment variables on startup
validateEnv();

const app = express();

// ─── Trust Proxy for Load Balancers ─────────────────────────────────────────
// Essential for rate-limiting and secure IP tracking when deployed behind
// reverse proxies (Nginx, AWS ELB, Render, Heroku). Without this, req.ip is
// always the proxy's internal IP, allowing rate limit bypasses or mass lockouts.
app.set('trust proxy', 1);

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// ─── Request Parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request ID Middleware ───────────────────────────────────────────────────
// Assigns a unique ID to every request so all log lines can be correlated
// in ELK / Grafana Loki by filtering on requestId.
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// ─── HTTP Request Logging ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  morgan.token('id', (req) => req.id);
  app.use(morgan(':id :method :url :status :response-time ms', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────
app.use('/api', globalLimiter);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'price-comparison-server',
    version: '1.0.0',
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/alerts',   alertRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/forum',    forumRoutes);
app.use('/api/ml',       mlRoutes);

// ─── Error Handlers ─────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Database Connection & Server Start ─────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`📦 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🤖 ML Service: ${process.env.ML_SERVICE_URL}`);
    // Initialize cron jobs after DB is ready
    if (process.env.NODE_ENV !== 'test') {
      initCronJobs();
    }
  });
  return server;
};

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = app;
