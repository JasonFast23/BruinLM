const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/bruinlm' });
  try {
    await pool.connect();
    console.log('Connected to DB');

    // Enable pgvector if available
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('pgvector extension ensured');
    } catch (e) {
      console.warn('pgvector extension not created (needs superuser or not installed):', e.message);
    }

    // Ensure documents table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        content TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns on documents
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'");
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP");
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error TEXT");
    console.log('documents columns ensured');

    // Ensure document_chunks table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536)
      )
    `);
    console.log('document_chunks ensured');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
  console.log('Migration complete');
}

run();
