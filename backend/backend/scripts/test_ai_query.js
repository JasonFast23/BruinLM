require('dotenv').config();
const { generateAIResponse } = require('../aiService');

async function testAIQuery() {
  const classId = 15;
  const question = "what do i need to know in order to understand finite state automata?";
  const aiName = "Andy";
  
  console.log('\n🤖 Testing AI query...');
  console.log(`Question: "${question}"\n`);
  
  const result = await generateAIResponse(classId, question, aiName);
  
  if (result.success) {
    console.log('✅ AI Response:\n');
    console.log(result.response);
    console.log('\n📚 Documents used:', result.documentsUsed);
  } else {
    console.log('❌ Error:', result.response);
  }
  
  process.exit(0);
}

testAIQuery().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
