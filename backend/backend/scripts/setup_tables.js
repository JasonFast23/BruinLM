const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env if dotenv is available
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // dotenv not available, continue without it
}

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

const TARGET_DB = process.env.DB_DATABASE || process.env.TARGET_DB || 'bruinlm';
const INIT_SQL_PATH = path.join(__dirname, '../init.sql');

async function run() {
  console.log('Setting up tables...');
  console.log(`Target database: ${TARGET_DB}`);
  
  // Check if init.sql exists
  if (!fs.existsSync(INIT_SQL_PATH)) {
    console.error(`Error: init.sql not found at ${INIT_SQL_PATH}`);
    process.exit(1);
  }
  
  const databaseUrl = getDatabaseUrl();
  const pool = new Pool({
    connectionString: databaseUrl
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Read the init SQL
    let initSql;
    try {
      initSql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    } catch (err) {
      console.error(`Error reading init.sql: ${err.message}`);
      process.exit(1);
    }
    
    // Split SQL into statements, handling comments properly
    // Remove single-line comments and split by semicolon
    const cleanedSql = initSql
      .split('\n')
      .map(line => {
        // Remove single-line comments
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');
    
    // Split by semicolon and filter out empty statements
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\s*$/));
    
    // Execute each statement
    for (const statement of statements) {
      try {
        // Handle pgvector extension separately with better error handling
        if (statement.toUpperCase().includes('CREATE EXTENSION') && statement.toUpperCase().includes('VECTOR')) {
          try {
            await client.query(statement);
            console.log('✅ pgvector extension created/enabled');
          } catch (extErr) {
            if (extErr.code === '58P01' || extErr.message.includes('No such file')) {
              console.warn('⚠️  Warning: pgvector extension not installed in PostgreSQL.');
              console.warn('   The extension is optional but recommended for vector search.');
              console.warn('   To install: https://github.com/pgvector/pgvector#installation');
              console.warn('   Continuing without pgvector...');
            } else if (extErr.code === '42501') {
              console.warn('⚠️  Warning: Insufficient privileges to create extension.');
              console.warn('   You may need superuser privileges or the extension may already exist.');
              console.warn('   Continuing...');
            } else {
              throw extErr;
            }
          }
        } else {
          await client.query(statement);
        }
      } catch (err) {
        // Some errors are acceptable (e.g., table already exists)
        if (err.code === '42P07' || err.message.includes('already exists')) {
          console.log(`ℹ️  ${err.message.split('\n')[0]}`);
        } else {
          console.error(`Error executing statement: ${err.message}`);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          throw err;
        }
      }
    }
    
    console.log('✅ Tables created successfully');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.code) {
      console.error(`   Error code: ${err.code}`);
    }
    if (err.message.includes('password authentication failed')) {
      console.error('\n💡 Tip: Check your DATABASE_URL or DB_PASSWORD in .env file');
    } else if (err.message.includes('does not exist')) {
      console.error(`\n💡 Tip: Make sure the database "${TARGET_DB}" exists`);
      console.error('   You can create it with: CREATE DATABASE bruinlm;');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure PostgreSQL is running');
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
  
  console.log('\n✅ Setup complete!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});