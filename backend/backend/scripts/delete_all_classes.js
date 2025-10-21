require('dotenv').config();
const pool = require('../db');

async function deleteAllClasses() {
  try {
    console.log('Deleting all classes and related data...');
    // Delete class memberships
    await pool.query('DELETE FROM class_members');
    // Delete class files (documents)
    await pool.query('DELETE FROM documents');
    // Delete class chat messages
    await pool.query('DELETE FROM chat_messages');
    // Delete classes
    await pool.query('DELETE FROM classes');
    console.log('✅ All classes deleted.');
    process.exit(0);
  } catch (err) {
    console.error('Error deleting all classes:', err);
    process.exit(1);
  }
}

deleteAllClasses();
