CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  ai_name VARCHAR(255) DEFAULT 'Andy',
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Class membership table
CREATE TABLE IF NOT EXISTS class_members (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, user_id)
);

-- Enable pgvector for embeddings (safe if already installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents uploaded to classes
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  content TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_status TEXT DEFAULT 'pending', -- pending|processing|extracted|processed|failed
  chunks_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP,
  last_error TEXT
);

-- Chunked document content with vector embeddings for RAG
-- text-embedding-3-small has 1536 dimensions
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536)
);

-- Optional: vector index (requires suitable ivfflat settings; create without errors if supported)
-- CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
--   ON document_chunks USING ivfflat (embedding vector_cosine_ops);