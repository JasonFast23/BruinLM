require('dotenv').config();
const { processDocument } = require('../aiService');

async function reprocessAllDocuments() {
  console.log('🔄 Starting document reprocessing...\n');
  
  // Hardcoded document IDs to reprocess
  const documentIds = [1]; // The finite-state-automata.pdf
  
  for (const docId of documentIds) {
    console.log(`\n📄 Processing document ${docId}...`);
    const result = await processDocument(docId);
    
    if (result.success) {
      console.log(`✅ Success! Created ${result.chunksCreated} chunks`);
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  }
  
  console.log('\n✅ All documents processed!');
  process.exit(0);
}

reprocessAllDocuments().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
