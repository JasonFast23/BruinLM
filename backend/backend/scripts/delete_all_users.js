require('dotenv').config();
const pool = require('../db');

async function deleteAllUsers() {
  try {
    // Get all user ids
    const users = await pool.query('SELECT id FROM users');
    const ids = users.rows.map(u => u.id);
    if (ids.length === 0) {
      console.log('No users to delete.');
      process.exit(0);
    }
    console.log(`Deleting ${ids.length} users and related data...`);
    // Delete related data
    await pool.query('DELETE FROM user_status WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM class_members WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM chat_messages WHERE user_id = ANY($1)', [ids]);
    // Delete users
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    console.log('✅ All users deleted.');
    process.exit(0);
  } catch (err) {
    console.error('Error deleting all users:', err);
    process.exit(1);
  }
}

deleteAllUsers();
