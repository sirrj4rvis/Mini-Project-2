const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Connects to MongoDB using the MONGO_URI environment variable.
 * Implements retry logic for production resilience.
 */
let mongoServer;

const connectDB = async (retries = 5, delay = 5000) => {
  if (process.env.NODE_ENV === 'test') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    const conn = await mongoose.connect(uri, { dbName: 'test_db' });
    logger.info(`✅ MongoDB In-Memory Connected`);
    return conn;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        dbName: 'pricelens',
        // Required for Node v24 + OpenSSL 3.5.5 with MongoDB Atlas
        tls: true,
        tlsAllowInvalidCertificates: true,
        // Connection pool: allow up to 10 concurrent DB operations,
        // keep at least 2 warm to prevent cold-start latency spikes.
        maxPoolSize: 10,
        minPoolSize: 2,
        // Fail fast if Atlas is unreachable rather than hanging indefinitely.
        serverSelectionTimeoutMS: 8000,
        // Socket-level timeout to detect hung connections early.
        socketTimeoutMS: 45000,
      });
      logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        logger.error('All MongoDB connection attempts exhausted. Exiting.');
        process.exit(1);
      }
      logger.info(`Retrying in ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

const disconnectDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

// Graceful shutdown on app termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed on app termination.');
  process.exit(0);
});

module.exports = { connectDB, disconnectDB };
