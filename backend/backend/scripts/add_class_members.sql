-- Add class_members table
CREATE TABLE IF NOT EXISTS class_members (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id),
  user_id INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, user_id)
);

-- Add the owner of each class as a member
INSERT INTO class_members (class_id, user_id)
SELECT id, owner_id FROM classes
ON CONFLICT DO NOTHING;