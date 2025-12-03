-- Migration: Add private chat rooms per user
-- This allows each user to have their own chat history in a class
-- while still sharing documents with other class members

-- Add a column to track which user's chat room this message belongs to
-- Note: user_id already exists but it tracks who sent the message
-- We need a separate column to track whose chat room this is in
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS chat_owner_id INTEGER REFERENCES users(id);

-- For existing messages, set chat_owner_id to the user_id
-- This ensures backward compatibility
UPDATE chat_messages 
SET chat_owner_id = user_id 
WHERE chat_owner_id IS NULL AND user_id IS NOT NULL;

-- For AI messages (where user_id is NULL), we need to figure out which user's
-- chat room they belong to. For now, we'll leave them NULL and handle in cleanup.
-- In the new system, AI messages will have chat_owner_id set to the user who asked the question.

-- Add an index for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_owner ON chat_messages(class_id, chat_owner_id);

-- Add comment for documentation
COMMENT ON COLUMN chat_messages.chat_owner_id IS 'The user who owns this chat room (private chat within a class)';
