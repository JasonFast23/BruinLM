-- Fix missing columns in documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'processed',
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS summary_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP;

-- Update existing documents to have proper status
UPDATE documents SET 
  processing_status = 'processed',
  processed_at = uploaded_at
WHERE processing_status IS NULL;