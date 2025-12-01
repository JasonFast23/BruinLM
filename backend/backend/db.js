const { Pool } = require('pg');

// Build DATABASE_URL from individual variables if DATABASE_URL is not set
function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Construct from individual DB_* variables (as mentioned in SETUP_GUIDE.md)
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbDatabase = process.env.DB_DATABASE || process.env.TARGET_DB || 'bruinlm';
  
  // Build connection string
  if (dbPassword) {
    return `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabase}`;
  } else {
    return `postgresql://${dbUser}@${dbHost}:${dbPort}/${dbDatabase}`;
  }
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;