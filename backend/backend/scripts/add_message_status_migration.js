require('dotenv').config();
const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function addMessageStatus() {
  console.log('🔄 Adding message status tracking to chat_messages table...');
  
  try {
    // Read and execute the SQL migration
    const sqlPath = path.join(__dirname, 'add_message_status.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Successfully added message status tracking');
    console.log('   - Added status column to chat_messages table');
    console.log('   - Created index for performance');
    console.log('   - Set existing messages to "active" status');
    console.log('   - Added constraint for valid status values');
    
  } catch (err) {
    console.error('❌ Error adding message status:', err);
    throw err;
  }
}

// Run the migration
if (require.main === module) {
  addMessageStatus()
    .then(() => {
      console.log('\n🎉 Message status migration completed successfully!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { addMessageStatus };