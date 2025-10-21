require('dotenv').config();
const OpenAI = require('openai');
const pool = require('../db');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000)
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('Error generating embedding:', err);
    return null;
  }
}

async function testAIQuery() {
  const classId = 15;
  const question = "what do i need to know in order to understand finite state automata?";
  
  console.log('\n🤖 Testing vector search...');
  console.log(`Question: "${question}"\n`);
  
  // Generate embedding for question
  const queryEmbedding = await generateEmbedding(question);
  
  if (!queryEmbedding) {
    console.log('❌ Could not generate query embedding');
    process.exit(1);
  }
  
  console.log('✅ Generated query embedding\n');
  
  // Search for relevant chunks
  const result = await pool.query(
    `SELECT d.filename, dc.content, dc.chunk_index,
            (dc.embedding <=> $1::vector) as distance
     FROM document_chunks dc
     JOIN documents d ON dc.document_id = d.id
     WHERE d.class_id = $2
     ORDER BY dc.embedding <=> $1::vector
     LIMIT 3`,
    [JSON.stringify(queryEmbedding), classId]
  );
  
  console.log(`🔍 Found ${result.rows.length} relevant chunks:\n`);
  
  result.rows.forEach((row, idx) => {
    console.log(`\n--- Chunk ${idx + 1} (distance: ${row.distance}) ---`);
    console.log(`File: ${row.filename}, Chunk: ${row.chunk_index}`);
    console.log(`Content: ${row.content.substring(0, 200)}...`);
  });
  
  // Now use OpenAI to generate response
  let context = 'Here are relevant excerpts from the course materials:\n\n';
  result.rows.forEach((row, idx) => {
    context += `Document ${idx + 1} (${row.filename}):\n${row.content}\n\n`;
  });
  
  console.log('\n\n🤖 Generating AI response...\n');
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are Andy, a friendly and helpful AI teaching assistant. Use the following course materials to answer the question:\n\n${context}`
      },
      { role: "user", content: question }
    ],
    temperature: 0.7,
    max_tokens: 500
  });
  
  console.log('✅ AI Response:\n');
  console.log(completion.choices[0].message.content);
  
  await pool.end();
  process.exit(0);
}

testAIQuery().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
