require('dotenv').config();
const pool = require('../db');

async function deleteEverything() {
  try {
    console.log('Deleting all users, documents, chunks, chat messages, class memberships, and user status...');
    // Delete document chunks
    await pool.query('DELETE FROM document_chunks');
    // Delete documents
    await pool.query('DELETE FROM documents');
    // Delete chat messages
    await pool.query('DELETE FROM chat_messages');
    // Delete class memberships
    await pool.query('DELETE FROM class_members');
    // Delete user status
    await pool.query('DELETE FROM user_status');
    // Delete users
    await pool.query('DELETE FROM users');
    console.log('✅ All data deleted. You now have a clean slate.');
    process.exit(0);
  } catch (err) {
    console.error('Error deleting everything:', err);
    process.exit(1);
  }
}

deleteEverything();
