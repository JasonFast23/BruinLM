const pool = require('./db');

/**
 * Automatically ensures the database schema is up to date
 * Runs on server startup to handle missing columns and migrations
 */
async function ensureSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking database schema...');
    
    // First check if the chat_messages table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'chat_messages'
    `);
    
    // If table doesn't exist yet, skip migration (init.sql will create it with the column)
    if (tableCheck.rows.length === 0) {
      console.log('   ℹ️  chat_messages table does not exist yet (will be created by init.sql)');
      return;
    }
    
    // Check if chat_owner_id column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' 
        AND column_name = 'chat_owner_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('📝 Adding missing chat_owner_id column to chat_messages table...');
      
      await client.query('BEGIN');
      
      // Add the column
      await client.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN chat_owner_id INTEGER REFERENCES users(id)
      `);
      
      // Migrate existing user messages
      const userMsgResult = await client.query(`
        UPDATE chat_messages 
        SET chat_owner_id = user_id 
        WHERE chat_owner_id IS NULL AND user_id IS NOT NULL
      `);
      console.log(`   ✅ Migrated ${userMsgResult.rowCount} existing user messages`);
      
      // Migrate existing AI messages to the user who asked
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
      
      // Delete orphaned AI messages that can't be matched
      const orphanedResult = await client.query(`
        DELETE FROM chat_messages 
        WHERE is_ai = true AND chat_owner_id IS NULL
        RETURNING id
      `);
      
      if (orphanedResult.rows.length > 0) {
        console.log(`   ⚠️  Deleted ${orphanedResult.rows.length} orphaned AI messages`);
      }
      
      // Create index for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_owner 
        ON chat_messages(class_id, chat_owner_id)
      `);
      
      await client.query('COMMIT');
      console.log('   ✅ Schema migration completed successfully');
    } else {
      console.log('   ✅ Schema is up to date');
    }
    
    // Ensure the index exists (in case it was missing)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_owner 
      ON chat_messages(class_id, chat_owner_id)
    `);
    
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    console.error('❌ Schema check failed:', err.message);
    // Don't throw - allow server to start even if migration fails
    // The error will be visible in logs for debugging
  } finally {
    client.release();
  }
}

module.exports = ensureSchema;

