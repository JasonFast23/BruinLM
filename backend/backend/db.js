const { Pool } = require('pg');

/**
 * Builds the database connection URL from environment variables.
 * Prioritizes DATABASE_URL if set, otherwise constructs from individual DB_* variables.
 *
 * @returns {string} The PostgreSQL connection string
 */
function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Construct from individual DB_* variables (as mentioned in SETUP_GUIDE.md)
  const databaseUser = process.env.DB_USER || 'postgres';
  const databasePassword = process.env.DB_PASSWORD || '';
  const databaseHost = process.env.DB_HOST || 'localhost';
  const databasePort = process.env.DB_PORT || '5432';
  const databaseName = process.env.DB_DATABASE || process.env.TARGET_DB || 'bruinlm';

  // Build connection string with or without password
  if (databasePassword) {
    return `postgresql://${databaseUser}:${databasePassword}@${databaseHost}:${databasePort}/${databaseName}`;
  } else {
    return `postgresql://${databaseUser}@${databaseHost}:${databasePort}/${databaseName}`;
  }
}

/**
 * PostgreSQL connection pool for the application.
 * Manages database connections efficiently by reusing them across requests.
 */
const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (error) => {
  console.error('Unexpected error on idle client', error);
});

module.exports = pool;