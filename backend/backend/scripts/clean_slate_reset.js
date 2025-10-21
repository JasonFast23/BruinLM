/**
 * Clean Slate Reset Script
 * Deletes all classes, documents, chat messages, and uploaded files
 * Use this to start completely fresh
 */

require('dotenv').config();
const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function cleanSlateReset() {
  console.log('🧹 Starting clean slate reset...\n');

  try {
    // Step 1: Delete all uploaded files from filesystem
    console.log('📁 Cleaning up uploaded files...');
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      console.log(`✅ Deleted ${deletedCount} uploaded files`);
    } else {
      console.log('📁 No uploads directory found');
    }

    // Step 2: Clear all database tables (in correct order due to foreign keys)
    console.log('\n🗄️ Clearing database tables...');

    // Clear chat messages first
    const chatResult = await pool.query('DELETE FROM chat_messages');
    console.log(`✅ Deleted ${chatResult.rowCount} chat messages`);

    // Clear document chunks and summaries
    const chunksResult = await pool.query('DELETE FROM document_chunks');
    console.log(`✅ Deleted ${chunksResult.rowCount} document chunks`);

    try {
      const summariesResult = await pool.query('DELETE FROM document_summaries');
      console.log(`✅ Deleted ${summariesResult.rowCount} document summaries`);
    } catch (err) {
      console.log('ℹ️ Document summaries table not found (skipping)');
    }

    try {
      const analyticsResult = await pool.query('DELETE FROM retrieval_analytics');
      console.log(`✅ Deleted ${analyticsResult.rowCount} retrieval analytics`);
    } catch (err) {
      console.log('ℹ️ Retrieval analytics table not found (skipping)');
    }

    // Clear documents
    const docsResult = await pool.query('DELETE FROM documents');
    console.log(`✅ Deleted ${docsResult.rowCount} documents`);

    // Clear class members (if exists)
    try {
      const membersResult = await pool.query('DELETE FROM class_members');
      console.log(`✅ Deleted ${membersResult.rowCount} class members`);
    } catch (err) {
      console.log('ℹ️ Class members table not found (skipping)');
    }

    // Clear classes
    const classesResult = await pool.query('DELETE FROM classes');
    console.log(`✅ Deleted ${classesResult.rowCount} classes`);

    // Clear user status (but keep users for login)
    try {
      const statusResult = await pool.query('DELETE FROM user_status');
      console.log(`✅ Deleted ${statusResult.rowCount} user status records`);
    } catch (err) {
      console.log('ℹ️ User status table not found (skipping)');
    }

    // Step 3: Reset database sequences (auto-increment counters)
    console.log('\n🔄 Resetting database sequences...');
    
    try {
      await pool.query('ALTER SEQUENCE classes_id_seq RESTART WITH 1');
      await pool.query('ALTER SEQUENCE documents_id_seq RESTART WITH 1');
      await pool.query('ALTER SEQUENCE document_chunks_id_seq RESTART WITH 1');
      await pool.query('ALTER SEQUENCE chat_messages_id_seq RESTART WITH 1');
      console.log('✅ Database sequences reset');
    } catch (err) {
      console.log('⚠️ Some sequences could not be reset (this is usually fine)');
    }

    // Step 4: Verify clean state
    console.log('\n🔍 Verifying clean state...');
    
    const verification = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM classes) as classes_count,
        (SELECT COUNT(*) FROM documents) as documents_count,
        (SELECT COUNT(*) FROM document_chunks) as chunks_count,
        (SELECT COUNT(*) FROM chat_messages) as messages_count
    `);
    
    const counts = verification.rows[0];
    console.log(`📊 Final counts:`);
    console.log(`   Classes: ${counts.classes_count}`);
    console.log(`   Documents: ${counts.documents_count}`);
    console.log(`   Chunks: ${counts.chunks_count}`);
    console.log(`   Messages: ${counts.messages_count}`);

    if (counts.classes_count === '0' && counts.documents_count === '0' && 
        counts.chunks_count === '0' && counts.messages_count === '0') {
      console.log('\n🎉 CLEAN SLATE ACHIEVED! ✨');
      console.log('Your BruinLM is now completely fresh and ready for new content!');
    } else {
      console.log('\n⚠️ Some data might still remain, but major cleanup completed');
    }

  } catch (error) {
    console.error('❌ Error during clean slate reset:', error);
    throw error;
  }
}

// Run the reset
if (require.main === module) {
  console.log('🚨 CLEAN SLATE RESET');
  console.log('This will DELETE ALL classes, documents, and chat messages!');
  console.log('Are you sure? This action cannot be undone.\n');
  
  // In a real scenario, you might want to add a confirmation prompt
  // For now, we'll proceed directly
  cleanSlateReset()
    .then(() => {
      console.log('\n✅ Clean slate reset completed successfully!');
      console.log('You can now create new classes and upload fresh documents.');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Clean slate reset failed:', err);
      process.exit(1);
    });
}

module.exports = { cleanSlateReset };