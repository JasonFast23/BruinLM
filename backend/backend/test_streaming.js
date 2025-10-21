require('dotenv').config();
const { generateAIResponseStream } = require('./aiService');

async function testStreaming() {
  console.log('Testing AI streaming...');
  
  try {
    let fullResponse = '';
    const chunks = [];
    
    for await (const chunk of generateAIResponseStream(1, "What is 2+2?", "Assistant")) {
      console.log('Chunk received:', {
        success: chunk.success,
        content: chunk.content?.substring(0, 50) + '...',
        finished: chunk.finished
      });
      
      if (chunk.success && chunk.content) {
        fullResponse += chunk.content;
        chunks.push(chunk.content);
      }
      
      if (chunk.finished) {
        break;
      }
    }
    
    console.log('\n=== STREAMING TEST RESULTS ===');
    console.log('Total chunks received:', chunks.length);
    console.log('Full response length:', fullResponse.length);
    console.log('First few chunks:', chunks.slice(0, 5));
    console.log('Response preview:', fullResponse.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('Streaming test failed:', error);
  }
}

testStreaming().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});