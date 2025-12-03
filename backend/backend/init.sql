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
  last_error TEXT,
  summary_generated BOOLEAN DEFAULT FALSE,
  summary_generated_at TIMESTAMP
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

-- Document summaries for hierarchical RAG retrieval
CREATE TABLE IF NOT EXISTS document_summaries (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  summary_embedding VECTOR(1536),
  key_topics TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages for class discussions
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_message_status CHECK (status IN ('active', 'cancelled', 'generating'))
);

-- Retrieval analytics for improving RAG performance
CREATE TABLE IF NOT EXISTS retrieval_analytics (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id),
  query_text TEXT,
  documents_retrieved INTEGER[],
  response_quality_score FLOAT,
  retrieval_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);
CREATE INDEX IF NOT EXISTS documents_class_id_processed_idx ON documents(class_id, processing_status) WHERE processing_status = 'processed';
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);

-- Optional: vector indexes (requires suitable ivfflat settings; create without errors if supported)
-- CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX IF NOT EXISTS document_summaries_embedding_idx ON document_summaries USING ivfflat (summary_embedding vector_cosine_ops) WITH (lists = 50);