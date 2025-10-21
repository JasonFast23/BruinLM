-- Add chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id),
    user_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    is_ai BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);