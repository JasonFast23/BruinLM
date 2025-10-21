require('dotenv').config();
const pool = require('../db');

async function deleteTestUsers(keepEmail) {
  try {
    // Find all users except the one to keep
    const users = await pool.query('SELECT id, email FROM users WHERE email != $1', [keepEmail]);
    if (users.rows.length === 0) {
      console.log('No test users to delete.');
      process.exit(0);
    }
    const ids = users.rows.map(u => u.id);
    console.log(`Deleting ${ids.length} test users...`);

    // Delete related data (user_status, class_members, chat_messages, etc.)
    await pool.query('DELETE FROM user_status WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM class_members WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM chat_messages WHERE user_id = ANY($1)', [ids]);
    // Delete users
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    console.log('✅ Test users deleted.');
    process.exit(0);
  } catch (err) {
    console.error('Error deleting test users:', err);
    process.exit(1);
  }
}

// Usage: node delete_test_users.js your@email.edu
const email = process.argv[2];
if (!email) {
  console.error('Usage: node delete_test_users.js your@email.edu');
  process.exit(1);
}
deleteTestUsers(email);
