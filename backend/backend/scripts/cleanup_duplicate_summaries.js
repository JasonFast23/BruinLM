const pool = require('../db');

async function cleanupDuplicateSummaries() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Starting cleanup: Removing duplicate document summaries...');
    
    // Find documents with multiple summaries
    const duplicatesResult = await client.query(`
      SELECT document_id, COUNT(*) as count
      FROM document_summaries
      GROUP BY document_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatesResult.rows.length === 0) {
      console.log('✅ No duplicate summaries found!');
      await client.query('COMMIT');
      return;
    }
    
    console.log(`Found ${duplicatesResult.rows.length} documents with duplicate summaries`);
    
    let totalDeleted = 0;
    
    // For each document with duplicates, keep only the oldest summary
    for (const dup of duplicatesResult.rows) {
      const documentId = dup.document_id;
      
      // Get document name for logging
      const docInfo = await client.query(
        'SELECT filename FROM documents WHERE id = $1',
        [documentId]
      );
      const filename = docInfo.rows[0]?.filename || `Document ${documentId}`;
      
      console.log(`📄 Processing ${filename} (${dup.count} summaries found)`);
      
      // Keep the oldest summary, delete the rest
      const deleteResult = await client.query(`
        DELETE FROM document_summaries
        WHERE document_id = $1
          AND id NOT IN (
            SELECT id
            FROM document_summaries
            WHERE document_id = $1
            ORDER BY created_at ASC
            LIMIT 1
          )
      `, [documentId]);
      
      const deleted = deleteResult.rowCount;
      totalDeleted += deleted;
      console.log(`  ✓ Deleted ${deleted} duplicate summary(ies)`);
    }
    
    await client.query('COMMIT');
    
    console.log('✅ Cleanup completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Documents processed: ${duplicatesResult.rows.length}`);
    console.log(`   - Duplicate summaries removed: ${totalDeleted}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Cleanup failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupDuplicateSummaries()
    .then(() => {
      console.log('🎉 Cleanup script completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Cleanup script failed:', err);
      process.exit(1);
    });
}

module.exports = cleanupDuplicateSummaries;
