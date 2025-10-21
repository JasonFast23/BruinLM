const fs = require('fs');
const { Pool } = require('pg');

// Config - adjust if your Postgres uses a different user/host/port
const POSTGRES_CONN = process.env.POSTGRES_CONN || 'postgresql://localhost:5432/postgres';
const TARGET_DB = process.env.TARGET_DB || 'bruinlm';
const INIT_SQL_PATH = __dirname + '/../init.sql';

async function run() {
  console.log('Bootstrap starting...');
  const adminPool = new Pool({ connectionString: POSTGRES_CONN });
  try {
    await adminPool.connect();
  } catch (err) {
    console.error('Failed to connect to Postgres with connection string', POSTGRES_CONN, err.message);
    process.exit(1);
  }

  try {
    // Try to create the target DB
    await adminPool.query(`CREATE DATABASE ${TARGET_DB}`);
    console.log(`Created database ${TARGET_DB}`);
  } catch (err) {
    if (err.code === '42P04') {
      console.log(`Database ${TARGET_DB} already exists`);
    } else {
      console.error('Error creating database:', err.message);
      await adminPool.end();
      process.exit(1);
    }
  }

  await adminPool.end();

  // Now run init SQL against the target DB
  let initSql = '';
  try {
    initSql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
  } catch (err) {
    console.error('Failed to read init.sql at', INIT_SQL_PATH, err.message);
    process.exit(1);
  }

  const targetPool = new Pool({ connectionString: (process.env.TARGET_CONN || `postgresql://localhost:5432/${TARGET_DB}`) });
  try {
    await targetPool.connect();
  } catch (err) {
    console.error('Failed to connect to target DB', TARGET_DB, err.message);
    process.exit(1);
  }

  try {
    await targetPool.query(initSql);
    console.log('Init SQL applied successfully');
  } catch (err) {
    console.error('Failed to apply init SQL:', err.message);
    await targetPool.end();
    process.exit(1);
  }

  await targetPool.end();
  console.log('Bootstrap complete');
}

run();
