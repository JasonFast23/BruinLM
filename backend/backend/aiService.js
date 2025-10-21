const OpenAI = require('openai');
const pool = require('./db');
const fs = require('fs');
const path = require('path');

// Import pdf-parse (simplified)
const pdfParse = require('pdf-parse');
console.log('✅ PDF-parse loaded successfully');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * On-demand document text: use stored content if present, otherwise extract from file now.
 * This enables instant Q&A without waiting for indexing.
 */
async function getDocumentsTextOnDemand(classId, limit = 5, perDocChars = 3000) {
  try {
    const res = await pool.query(
      `SELECT id, filename, filepath, content
       FROM documents
       WHERE class_id = $1
       ORDER BY uploaded_at DESC
       LIMIT $2`,
      [classId, limit]
    );
    const out = [];
    for (const row of res.rows) {
      let text = row.content;
      if (!text || text.trim().length < 10) {
        // Extract on-demand from the source file (should be rare now with instant processing)
        try { 
          console.log(`⚡ On-demand extraction for ${row.filename}`);
          text = await extractTextFromFile(row.filepath); 
        } catch (e) { 
          console.log(`⚠️ Could not extract text for ${row.filename}`);
          text = ''; 
        }
      }
      if (text && text.trim().length > 0) {
        out.push({ filename: row.filename, content: text.slice(0, perDocChars) });
      }
      if (out.length >= limit) break;
    }
    console.log(`📚 Retrieved ${out.length} documents instantly for AI query`);
    return out;
  } catch (e) {
    console.error('Error getting on-demand document text:', e);
    return [];
  }
}

/**
 * Extract text content from uploaded file
 */
async function extractTextFromFile(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  
  try {
    if (ext === '.txt') {
      return fs.readFileSync(filepath, 'utf-8');
    } else if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filepath);
      console.log(`🔍 PDF buffer size: ${dataBuffer.length} bytes`);
      
      const result = await pdfParse(dataBuffer);
      const extractedText = result.text || '';
      console.log(`✅ PDF text extracted: ${extractedText.length} characters`);
      
      if (extractedText.length > 100) {
        console.log(`📄 Preview: ${extractedText.substring(0, 200)}...`);
      }
      
      return extractedText;
    } else if (ext === '.doc' || ext === '.docx') {
      // Optional: integrate 'mammoth' for DOCX extraction in future
      return '';
    }
    return '';
  } catch (err) {
    console.error('Error extracting text:', err);
    return '';
  }
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000) // Limit to ~8000 chars for embedding
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('Error generating embedding:', err);
    return null;
  }
}

/**
 * Split text into chunks for better RAG
 */
function splitIntoChunks(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    chunks.push(chunk);
    start += chunkSize - overlap; // Overlap for context continuity
  }
  
  return chunks;
}

/**
 * Process and store document with embeddings
 */
async function processDocument(documentId) {
  try {
    // Get document info
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1',
      [documentId]
    );
    
    if (docResult.rows.length === 0) {
      return { success: false, error: 'Document not found' };
    }
    
  const doc = docResult.rows[0];
  // mark processing start
  try { await pool.query('UPDATE documents SET processing_status = $1, last_error = NULL WHERE id = $2', ['processing', documentId]); } catch(_) {}
    
    // Extract text from file
    let text = await extractTextFromFile(doc.filepath);
    
    if (!text || text.trim().length < 10) {
      return { success: false, error: 'Could not extract meaningful text from file' };
    }
    
    // Remove null bytes and other problematic characters for PostgreSQL
    text = text.replace(/\0/g, '').replace(/\u0000/g, '');
    
    console.log(`📄 Processing document ${documentId}: ${doc.filename} (${text.length} chars)`);
    
    // Store the extracted text content and mark extracted
    await pool.query(
      'UPDATE documents SET content = $1, processing_status = $2 WHERE id = $3',
      [text, 'extracted', documentId]
    );
    
    // Split into chunks
    const chunks = splitIntoChunks(text);
    console.log(`📦 Split into ${chunks.length} chunks`);
    
    // Generate embeddings for each chunk and store
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].replace(/\0/g, ''); // Clean chunk too
      const embedding = await generateEmbedding(chunk);
      
      if (embedding) {
        await pool.query(
          'INSERT INTO document_chunks (document_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4::vector)',
          [documentId, i, chunk, JSON.stringify(embedding)]
        );
      }
      
      // Small delay to avoid rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Document ${documentId} processed successfully with ${chunks.length} chunks`);
    try { await pool.query('UPDATE documents SET chunks_count = $1, processing_status = $2, processed_at = NOW() WHERE id = $3', [chunks.length, 'processed', documentId]); } catch(_) {}
    
    // 🚀 NEW: Generate document summary for hierarchical retrieval
    console.log(`🧠 Generating smart summary for ${doc.filename}...`);
    const summaryResult = await generateAndStoreDocumentSummary(documentId);
    if (summaryResult.success) {
      console.log(`📝 Smart summary generated: ${summaryResult.keyTopics.length} key topics identified`);
    } else {
      console.log(`⚠️ Summary generation failed: ${summaryResult.message}`);
    }
    
    return { 
      success: true, 
      chunksCreated: chunks.length,
      summaryGenerated: summaryResult.success,
      keyTopics: summaryResult.keyTopics || []
    };
  } catch (err) {
    console.error('Error processing document:', err);
    try { await pool.query('UPDATE documents SET processing_status = $1, last_error = $2 WHERE id = $3', ['failed', err.message?.slice(0, 500) || 'error', documentId]); } catch(_) {}
    return { success: false, error: err.message };
  }
}

/**
 * Retrieve relevant documents for a query using vector similarity
 */
async function retrieveRelevantDocuments(classId, query) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.log('⚠️ Could not generate query embedding, falling back to keyword search');
      // Fallback to simple content retrieval
      const result = await pool.query(
        `SELECT d.filename, dc.content 
         FROM document_chunks dc
         JOIN documents d ON dc.document_id = d.id
         WHERE d.class_id = $1
         LIMIT 3`,
        [classId]
      );
      return result.rows;
    }
    
    // Use pgvector cosine similarity to find most relevant chunks
    const result = await pool.query(
      `SELECT d.filename, dc.content, 
              (dc.embedding <=> $1::vector) as distance
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE d.class_id = $2
       ORDER BY dc.embedding <=> $1::vector
       LIMIT 5`,
      [JSON.stringify(queryEmbedding), classId]
    );
    
    console.log(`🔍 Found ${result.rows.length} relevant chunks for query`);
    
    return result.rows;
  } catch (err) {
    console.error('Error retrieving documents:', err);
    return [];
  }
}

/**
 * Generate AI response using RAG
 */
async function generateAIResponse(classId, question, aiName = 'Andy') {
  try {
    // 🚀 NEW: Use optimized hierarchical retrieval
    console.log(`🤖 Generating AI response with optimized retrieval for class ${classId}`);
    
    let relevantDocs = await retrieveRelevantDocumentsOptimized(classId, question);
    
    // If optimized retrieval found nothing, fall back to on-demand content
    if (!relevantDocs || relevantDocs.length === 0) {
      console.log('📄 No optimized results, falling back to on-demand content...');
      const docs = await getDocumentsTextOnDemand(classId, 4, 2000);
      relevantDocs = docs.map(s => ({ filename: s.filename, content: s.content }));
    }
    
    // Build context from documents
    let context = '';
    if (relevantDocs.length > 0) {
      context = 'Here are relevant excerpts from the course materials:\n\n';
      relevantDocs.forEach((doc, idx) => {
        context += `Document ${idx + 1} (${doc.filename}):\n${doc.content}\n\n`;
      });
    } else {
      context = 'Here is available context from the class materials (latest uploads first):\n\n';
    }
    
    // Create the prompt with current date/time context
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const timeString = currentDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const systemPrompt = `You are Claude, a helpful AI assistant. You can answer any question across all domains of knowledge, just like the real Claude.

CURRENT CONTEXT:
- Today is: ${dateString}
- Current time: ${timeString}
- Year: ${currentDate.getFullYear()}

Core principles:
- Be direct and concise - get straight to the point
- If you don't know something, simply say "I don't know" rather than guessing or being evasive
- Answer general knowledge questions directly without unnecessary context
- For simple questions (like "what day is today?"), give simple answers using the current context above
- Be honest about your limitations
- Use the current date/time information provided above for any time-related questions

Response priorities:
1. FIRST: Check if the question relates to uploaded course materials - if so, prioritize that information
2. SECOND: If no course materials are relevant, answer using your general knowledge
3. Always be helpful and direct regardless of the question type

Formatting guidelines:
- Use **bold text** for key terms, concepts, and important headings
- Use bullet points and numbered lists when they help organize information clearly
- Avoid messy markdown headers (###, ##, #) - use **bold text** instead for section titles
- Avoid excessive special symbols (***, ^^^, $$$, etc.) 
- Be thorough and detailed in your analysis
- Structure your response clearly with proper organization

For course-related questions:
- Reference course materials when available and relevant
- Explain concepts clearly and practically
- Provide examples from the materials when helpful

For general questions:
- Answer directly using your knowledge and the current context provided above
- For date/time questions, use the exact current date/time information provided
- Don't deflect to course-related topics unless truly relevant
- Be helpful across all subjects: science, math, current events, practical advice, etc.
- For real-time information I don't have (weather, breaking news, stock prices), honestly say "I don't know"

Visual help:
- For diagrams, automata, or mathematical figures, provide complete LaTeX/TikZ code
- Use proper academic notation and clear labeling
- Make visual representations accurate and publication-quality

Remember: Be Claude - direct, helpful, knowledgeable across all domains, honest about limitations, and prioritize course materials when relevant.`;

    const userPrompt = context.length > 0 
  ? `Course materials available:
${context}

Question: "${question}"

Answer directly. Use course materials if relevant, otherwise use general knowledge.

Formatting notes:
- Use **bold text** for key terms and section titles instead of ### headers
- Use bullet points and lists when they help organize information
- Be thorough and detailed in your analysis
- Structure information clearly for easy reading`
      : `Question: "${question}"

Answer directly using your general knowledge.

CRITICAL FORMATTING RULES:
- ABSOLUTELY NO markdown headers (###, ##, #) - they look unprofessional
- ABSOLUTELY NO bullet points with symbols (-, *, +) - write in paragraphs instead  
- ABSOLUTELY NO special characters (***, ^^^, $$$, ---, ===, ~~~) for formatting
- Use **bold** for emphasis only - no other formatting
- Write naturally in clean paragraphs like ChatGPT
- Use simple line breaks between paragraphs, not headers or symbols`;

    // Call OpenAI with Claude-like settings
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using mini for cost efficiency, can upgrade to gpt-4o
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // Lower for more focused, direct responses like Claude
      max_tokens: 2000, // Sufficient for detailed responses when needed
      stream: false
    });
    
    return {
      success: true,
      response: response.choices[0].message.content,
      documentsUsed: relevantDocs.map(d => d.filename)
    };
  } catch (err) {
    console.error('Error generating AI response:', err);
    
    if (err.code === 'insufficient_quota') {
      return {
        success: false,
        response: "Sorry, the OpenAI API quota has been exceeded. Please check your API key and billing."
      };
    }
    
    if (err.status === 401) {
      return {
        success: false,
        response: "Sorry, the OpenAI API key is invalid or not configured. Please contact the administrator."
      };
    }
    
    return {
      success: false,
      response: "Sorry, I encountered an error processing your request. Please try again."
    };
  }
}

/**
 * Streaming version of generateAIResponse for character-by-character output
 */
async function* generateAIResponseStream(classId, question, aiName = 'Andy') {
  try {
    // 🚀 Use optimized hierarchical retrieval (same as non-streaming)
    console.log(`🤖 Generating streaming AI response for class ${classId}`);
    
    let relevantDocs = await retrieveRelevantDocumentsOptimized(classId, question);
    
    // If optimized retrieval found nothing, fall back to on-demand content
    if (!relevantDocs || relevantDocs.length === 0) {
      console.log('📄 No optimized results, falling back to on-demand content...');
      const docs = await getDocumentsTextOnDemand(classId, 4, 2000);
      relevantDocs = docs.map(s => ({ filename: s.filename, content: s.content }));
    }
    
    // Build context from documents
    let context = '';
    if (relevantDocs.length > 0) {
      context = 'Here are relevant excerpts from the course materials:\n\n';
      relevantDocs.forEach((doc, idx) => {
        context += `Document ${idx + 1} (${doc.filename}):\n${doc.content}\n\n`;
      });
    } else {
      context = 'Here is available context from the class materials (latest uploads first):\n\n';
    }
    
    // Create the prompt with current date/time context
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeString = currentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const systemPrompt = `You are Claude, a helpful AI assistant. You can answer any question across all domains of knowledge, just like the real Claude.

CURRENT CONTEXT:
- Today is: ${dateString}
- Current time: ${timeString}
- Year: ${currentDate.getFullYear()}

Core principles:
- Be direct and concise - get straight to the point
- If you don't know something, simply say "I don't know" rather than guessing or being evasive
- Answer general knowledge questions directly without unnecessary context
- For simple questions (like "what day is today?"), give simple answers using the current context above
- Be honest about your limitations
- Use the current date/time information provided above for any time-related questions

Response priorities:
1. FIRST: Check if the question relates to uploaded course materials - if so, prioritize that information
2. SECOND: If no course materials are relevant, answer using your general knowledge
3. Always be helpful and direct regardless of the question type

Formatting guidelines:
- Use **bold text** for key terms, concepts, and important headings
- Use bullet points and numbered lists when they help organize information clearly
- Avoid messy markdown headers (###, ##, #) - use **bold text** instead for section titles
- Avoid excessive special symbols (***, ^^^, $$$, etc.) 
- Be thorough and detailed in your analysis
- Structure your response clearly with proper organization

For course-related questions:
- Reference course materials when available and relevant
- Explain concepts clearly and practically
- Provide examples from the materials when helpful

For general questions:
- Answer directly using your knowledge and the current context provided above
- For date/time questions, use the exact current date/time information provided
- Don't deflect to course-related topics unless truly relevant
- Be helpful across all subjects: science, math, current events, practical advice, etc.
- For real-time information I don't have (weather, breaking news, stock prices), honestly say "I don't know"

Visual help:
- For diagrams, automata, or mathematical figures, provide complete LaTeX/TikZ code
- Use proper academic notation and clear labeling
- Make visual representations accurate and publication-quality

Remember: Be Claude - direct, helpful, knowledgeable across all domains, honest about limitations, and prioritize course materials when relevant.`;

    const userPrompt = context.length > 0 
      ? `Course materials available:
${context}

Question: "${question}"

Answer directly. Use course materials if relevant, otherwise use general knowledge.

Formatting notes:
- Use **bold text** for key terms and section titles instead of ### headers
- Use bullet points and lists when they help organize information
- Be thorough and detailed in your analysis
- Structure information clearly for easy reading`
      : `Question: "${question}"

Answer directly using your general knowledge.

CRITICAL FORMATTING RULES:
- ABSOLUTELY NO markdown headers (###, ##, #) - they look unprofessional
- ABSOLUTELY NO bullet points with symbols (-, *, +) - write in paragraphs instead  
- ABSOLUTELY NO special characters (***, ^^^, $$$, ---, ===, ~~~) for formatting
- Use **bold** for emphasis only - no other formatting
- Write naturally in clean paragraphs like ChatGPT
- Use simple line breaks between paragraphs, not headers or symbols`;

    // Call OpenAI with streaming enabled
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: true
    });
    
    // Yield each chunk as it arrives
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield {
          success: true,
          content: content,
          finished: false,
          documentsUsed: relevantDocs.map(d => d.filename)
        };
      }
    }
    
    // Signal completion
    yield {
      success: true,
      content: '',
      finished: true,
      documentsUsed: relevantDocs.map(d => d.filename)
    };
    
  } catch (err) {
    console.error('Error generating streaming AI response:', err);
    
    let errorMessage = "Sorry, I encountered an error processing your request. Please try again.";
    
    if (err.code === 'insufficient_quota') {
      errorMessage = "Sorry, the OpenAI API quota has been exceeded. Please check your API key and billing.";
    } else if (err.status === 401) {
      errorMessage = "Sorry, the OpenAI API key is invalid or not configured. Please contact the administrator.";
    }
    
    yield {
      success: false,
      content: errorMessage,
      finished: true
    };
  }
}

/**
 * AGENTIC RAG OPTIMIZATIONS - Making the system smarter as it scales!
 */

/**
 * Generate a comprehensive summary of a document for hierarchical retrieval
 */
async function generateDocumentSummary(content, filename) {
  try {
    const summaryPrompt = `Please create a comprehensive summary of this educational document that will help with information retrieval. Include:

1. Main topics and concepts covered
2. Key definitions and terminology  
3. Important formulas, equations, or procedures
4. Examples and case studies mentioned
5. Learning objectives or key takeaways

Document: ${filename}
Content: ${content.substring(0, 4000)}...

Provide a detailed summary that captures the essence and searchable concepts:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.3, // Lower temperature for consistent summaries
      max_tokens: 400
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('Error generating document summary:', err);
    // Fallback to truncated content
    return content.substring(0, 1000) + '...';
  }
}

/**
 * Extract key topics from document content using AI
 */
async function extractKeyTopics(content) {
  try {
    const topicsPrompt = `Extract 5-10 key topics, concepts, or keywords from this educational content. Return them as a comma-separated list:

${content.substring(0, 2000)}...

Key topics:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [{ role: "user", content: topicsPrompt }],
      temperature: 0.2,
      max_tokens: 100
    });

    const topicsText = response.choices[0].message.content;
    return topicsText.split(',').map(topic => topic.trim()).filter(topic => topic.length > 0);
  } catch (err) {
    console.error('Error extracting topics:', err);
    return [];
  }
}

/**
 * Generate and store document summary with embedding for hierarchical retrieval
 */
async function generateAndStoreDocumentSummary(documentId) {
  try {
    // Get document info and content
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND summary_generated = FALSE',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return { success: false, message: 'Document not found or summary already generated' };
    }

    const doc = docResult.rows[0];
    let content = doc.content;

    // If no content stored, extract from file
    if (!content || content.trim().length < 100) {
      content = await extractTextFromFile(doc.filepath);
    }

    if (!content || content.trim().length < 100) {
      return { success: false, message: 'Insufficient content to summarize' };
    }

    console.log(`📝 Generating summary for document: ${doc.filename}`);

    // Generate summary and topics
    const [summary, keyTopics] = await Promise.all([
      generateDocumentSummary(content, doc.filename),
      extractKeyTopics(content)
    ]);

    // Generate embedding for the summary
    const summaryEmbedding = await generateEmbedding(summary);

    if (!summaryEmbedding) {
      return { success: false, message: 'Failed to generate summary embedding' };
    }

    // Store summary in database
    await pool.query(
      `INSERT INTO document_summaries (document_id, summary, summary_embedding, key_topics)
       VALUES ($1, $2, $3::vector, $4)`,
      [documentId, summary, JSON.stringify(summaryEmbedding), keyTopics]
    );

    // Mark document as summarized
    await pool.query(
      'UPDATE documents SET summary_generated = TRUE, summary_generated_at = NOW() WHERE id = $1',
      [documentId]
    );

    console.log(`✅ Summary generated for ${doc.filename} with ${keyTopics.length} key topics`);

    return { 
      success: true, 
      summary,
      keyTopics,
      message: `Summary generated for ${doc.filename}` 
    };

  } catch (err) {
    console.error('Error generating document summary:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Smart hierarchical retrieval: First find relevant documents, then search within them
 */
async function smartHierarchicalRetrieval(classId, query, limit = 5) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.log('⚠️ Query embedding failed, falling back to basic retrieval');
      return await retrieveRelevantDocuments(classId, query);
    }

    // Stage 1: Find relevant documents via summaries
    console.log('🔍 Stage 1: Finding relevant documents via summaries...');
    
    const relevantDocsResult = await pool.query(
      `SELECT ds.document_id, d.filename, ds.summary,
              (ds.summary_embedding <=> $1::vector) as summary_distance
       FROM document_summaries ds
       JOIN documents d ON ds.document_id = d.id
       WHERE d.class_id = $2
       ORDER BY ds.summary_embedding <=> $1::vector
       LIMIT 3`,
      [JSON.stringify(queryEmbedding), classId]
    );

    if (relevantDocsResult.rows.length === 0) {
      console.log('📄 No document summaries found, falling back to chunk search');
      return await retrieveRelevantDocuments(classId, query);
    }

    const relevantDocIds = relevantDocsResult.rows.map(row => row.document_id);
    console.log(`📚 Found ${relevantDocIds.length} relevant documents:`, 
               relevantDocsResult.rows.map(r => r.filename));

    // Stage 2: Search chunks within relevant documents
    console.log('🔍 Stage 2: Searching chunks within relevant documents...');
    
    const chunksResult = await pool.query(
      `SELECT d.filename, dc.content,
              (dc.embedding <=> $1::vector) as chunk_distance
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.document_id = ANY($2)
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(queryEmbedding), relevantDocIds, limit]
    );

    console.log(`🎯 Smart retrieval found ${chunksResult.rows.length} relevant chunks from ${relevantDocIds.length} documents`);

    return chunksResult.rows;

  } catch (err) {
    console.error('Error in smart hierarchical retrieval:', err);
    console.log('🔄 Falling back to basic retrieval...');
    return await retrieveRelevantDocuments(classId, query);
  }
}

/**
 * Adaptive context window based on class size and content
 */
async function getAdaptiveContextStrategy(classId) {
  try {
    // Get class statistics
    const stats = await pool.query(
      `SELECT 
         COUNT(DISTINCT d.id) as total_documents,
         COUNT(DISTINCT dc.id) as total_chunks,
         AVG(LENGTH(d.content)) as avg_document_length
       FROM documents d
       LEFT JOIN document_chunks dc ON d.id = dc.document_id
       WHERE d.class_id = $1 AND d.processing_status = 'processed'`,
      [classId]
    );

    const { total_documents, total_chunks, avg_document_length } = stats.rows[0];
    
    let strategy;
    
    if (total_documents <= 3) {
      // Small class: include more context
      strategy = {
        maxChunks: 8,
        charsPerChunk: 2000,
        reasoning: 'Small class - comprehensive context'
      };
    } else if (total_documents <= 15) {
      // Medium class: balanced approach  
      strategy = {
        maxChunks: 5,
        charsPerChunk: 1500,
        reasoning: 'Medium class - balanced context'
      };
    } else {
      // Large class: highly selective
      strategy = {
        maxChunks: 3,
        charsPerChunk: 1200,
        reasoning: 'Large class - selective context'
      };
    }

    console.log(`📊 Adaptive context for class ${classId}: ${strategy.reasoning} (${total_documents} docs, ${total_chunks} chunks)`);
    
    return strategy;

  } catch (err) {
    console.error('Error getting adaptive context strategy:', err);
    return { maxChunks: 5, charsPerChunk: 1500, reasoning: 'Default fallback' };
  }
}

/**
 * Enhanced retrieve function with all optimizations
 */
async function retrieveRelevantDocumentsOptimized(classId, query) {
  try {
    console.log(`🚀 Starting optimized retrieval for class ${classId}`);
    
    // Get adaptive context strategy
    const contextStrategy = await getAdaptiveContextStrategy(classId);
    
    // Try smart hierarchical retrieval first
    let relevantChunks = await smartHierarchicalRetrieval(classId, query, contextStrategy.maxChunks);
    
    // If hierarchical retrieval found nothing, fall back to basic retrieval
    if (!relevantChunks || relevantChunks.length === 0) {
      console.log('🔄 Hierarchical retrieval found nothing, trying basic retrieval...');
      relevantChunks = await retrieveRelevantDocuments(classId, query);
    }

    // Truncate content according to adaptive strategy
    const optimizedChunks = relevantChunks.slice(0, contextStrategy.maxChunks).map(chunk => ({
      ...chunk,
      content: chunk.content.substring(0, contextStrategy.charsPerChunk)
    }));

    console.log(`✅ Optimized retrieval complete: ${optimizedChunks.length} chunks (${contextStrategy.reasoning})`);
    
    return optimizedChunks;

  } catch (err) {
    console.error('Error in optimized retrieval:', err);
    // Final fallback to original function
    return await retrieveRelevantDocuments(classId, query);
  }
}

module.exports = {
  extractTextFromFile,
  generateEmbedding,
  processDocument,
  retrieveRelevantDocuments,
  generateAIResponse,
  generateAIResponseStream, // New streaming function
  // New optimized functions
  generateAndStoreDocumentSummary,
  smartHierarchicalRetrieval,
  getAdaptiveContextStrategy,
  retrieveRelevantDocumentsOptimized
};