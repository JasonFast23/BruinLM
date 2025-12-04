// Load environment variables from .env if dotenv is available
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {
  // dotenv not available, continue without it
}

const pool = require('../db');

async function migratePrivateChatrooms() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Starting migration: Adding private chat rooms per user...');
    
    // Add chat_owner_id column if it doesn't exist
    console.log('📝 Adding chat_owner_id column...');
    await client.query(`
      ALTER TABLE chat_messages 
      ADD COLUMN IF NOT EXISTS chat_owner_id INTEGER REFERENCES users(id)
    `);
    
    // For existing user messages, set chat_owner_id to the user_id
    console.log('📝 Migrating existing user messages...');
    const userMsgResult = await client.query(`
      UPDATE chat_messages 
      SET chat_owner_id = user_id 
      WHERE chat_owner_id IS NULL AND user_id IS NOT NULL
    `);
    console.log(`✅ Updated ${userMsgResult.rowCount} user messages`);
    
    // For existing AI messages, we need to figure out which user's chat room they belong to
    // Strategy: Match AI messages to the user message that came right before them
    console.log('📝 Migrating existing AI messages...');
    await client.query(`
      WITH ai_messages AS (
        SELECT 
          cm.id,
          cm.class_id,
          cm.created_at,
          (
            SELECT user_id 
            FROM chat_messages prev 
            WHERE prev.class_id = cm.class_id 
              AND prev.created_at < cm.created_at 
              AND prev.user_id IS NOT NULL 
            ORDER BY prev.created_at DESC 
            LIMIT 1
          ) as inferred_owner
        FROM chat_messages cm
        WHERE cm.is_ai = true AND cm.chat_owner_id IS NULL
      )
      UPDATE chat_messages cm
      SET chat_owner_id = ai_messages.inferred_owner
      FROM ai_messages
      WHERE cm.id = ai_messages.id
        AND ai_messages.inferred_owner IS NOT NULL
    `);
    
    // Count remaining orphaned AI messages
    const orphanedResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM chat_messages 
      WHERE is_ai = true AND chat_owner_id IS NULL
    `);
    const orphanedCount = parseInt(orphanedResult.rows[0].count);
    
    if (orphanedCount > 0) {
      console.log(`⚠️  ${orphanedCount} AI messages could not be matched to a user`);
      console.log('   These will be deleted as they cannot be assigned to a private chat room');
      
      // Delete orphaned AI messages
      await client.query(`
        DELETE FROM chat_messages 
        WHERE is_ai = true AND chat_owner_id IS NULL
      `);
      console.log(`✅ Deleted ${orphanedCount} orphaned AI messages`);
    }
    
    // Create index for efficient querying
    console.log('📝 Creating index for private chat rooms...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_owner 
      ON chat_messages(class_id, chat_owner_id)
    `);
    
    // Add comment for documentation
    await client.query(`
      COMMENT ON COLUMN chat_messages.chat_owner_id IS 
      'The user who owns this chat room (private chat within a class)'
    `);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Added chat_owner_id column');
    console.log('   - Migrated existing messages to private chat rooms');
    console.log('   - Created performance index');
    console.log('   - Each user now has their own private chat room within each class');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePrivateChatrooms()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = migratePrivateChatrooms;
