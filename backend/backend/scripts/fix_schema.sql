-- Add missing columns to documents table for compatibility
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Update existing documents to have proper status
UPDATE documents SET processing_status = 'processed' WHERE processing_status IS NULL;