const logger = require('../config/logger');

/**
 * Global error handler middleware.
 * Catches all errors passed via next(err) and returns a consistent JSON response.
 * Logs full structured context: method, URL, requestId, user, stack.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // ─ Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(', ');
  }

  // ─ Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists`;
  }

  // ─ Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ─ JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Structured log with full context for tracing in log aggregators
  const logContext = {
    statusCode,
    method:    req.method,
    url:       req.originalUrl,
    requestId: req.id,
    userId:    req.user?._id,
    stack:     err.stack,
  };

  if (statusCode >= 500) {
    logger.error(`[ErrorHandler] ${statusCode} ${message}`, logContext);
  } else {
    logger.warn(`[ErrorHandler] ${statusCode} ${message}`, logContext);
  }

  res.status(statusCode).json({
    success:   false,
    message,
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler — fires when no routes matched the request.
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = { errorHandler, notFoundHandler };
