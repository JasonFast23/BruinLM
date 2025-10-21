const pool = require('../db');

(async function() {
  try {
    await pool.query("ALTER TABLE classes ADD COLUMN IF NOT EXISTS owner_id INTEGER;");
    console.log('Migration applied');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
})();
