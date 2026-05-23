require('dotenv').config();

/**
 * Validates that all required environment variables are set.
 * Throws on startup if any critical variables are missing.
 */
const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RAPIDAPI_KEY',
  'RAPIDAPI_HOST',
];

const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please copy .env.example to .env and fill in all values.');
    process.exit(1);
  }
  console.log('✅ Environment variables validated.');
};

module.exports = { validateEnv };
