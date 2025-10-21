-- Optimization Script: Enable Smart Vector Indexing and Add Document Summaries
-- Run this script to implement the agentic RAG optimizations

-- Step 1: Enable vector index for fast similarity search
-- This index dramatically speeds up cosine similarity searches
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 2: Add document summaries table for hierarchical retrieval
CREATE TABLE IF NOT EXISTS document_summaries (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  summary_embedding VECTOR(1536),
  key_topics TEXT[], -- Array of key topics/concepts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Add index for document summaries
CREATE INDEX IF NOT EXISTS document_summaries_embedding_idx
  ON document_summaries USING ivfflat (summary_embedding vector_cosine_ops)
  WITH (lists = 50);

-- Step 4: Add retrieval analytics table for adaptive learning
CREATE TABLE IF NOT EXISTS retrieval_analytics (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id),
  query_text TEXT,
  documents_retrieved INTEGER[],
  response_quality_score FLOAT, -- Future: user feedback
  retrieval_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Add indexes for better performance
CREATE INDEX IF NOT EXISTS documents_class_id_processed_idx 
  ON documents(class_id, processing_status) 
  WHERE processing_status = 'processed';

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx 
  ON document_chunks(document_id);

-- Step 6: Update documents table to track summary status
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS summary_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP;

COMMENT ON INDEX document_chunks_embedding_idx IS 'Fast vector similarity search for document chunks';
COMMENT ON INDEX document_summaries_embedding_idx IS 'Fast vector similarity search for document summaries';
COMMENT ON TABLE document_summaries IS 'Document-level summaries for hierarchical RAG retrieval';
COMMENT ON TABLE retrieval_analytics IS 'Analytics for improving retrieval performance over time';