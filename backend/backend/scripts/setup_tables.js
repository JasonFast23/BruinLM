const fs = require('fs');
const { Pool } = require('pg');

const TARGET_DB = process.env.TARGET_DB || 'bruinlm';
const INIT_SQL_PATH = __dirname + '/../init.sql';

async function run() {
  console.log('Setting up tables...');
  
  // Connect directly to the target database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://localhost:5432/${TARGET_DB}`
  });

  try {
    await pool.connect();
    console.log('Connected to database');

    // Read the init SQL
    const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    
    // Apply the SQL
    await pool.query(initSql);
    console.log('Tables created successfully');
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  console.log('Setup complete');
}

run();