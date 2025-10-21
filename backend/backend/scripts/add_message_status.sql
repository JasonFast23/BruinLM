-- Add status column to chat_messages table to track cancelled/completed messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create index for better performance when filtering by status
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);

-- Update existing messages to have 'active' status
UPDATE chat_messages SET status = 'active' WHERE status IS NULL;

-- Add constraint to ensure status has valid values
ALTER TABLE chat_messages ADD CONSTRAINT check_message_status 
CHECK (status IN ('active', 'cancelled', 'generating'));