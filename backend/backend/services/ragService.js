/**
 * RAG (Retrieval-Augmented Generation) service
 * Handles document retrieval, hierarchical search, and AI response generation
 */

const pool = require('../db');
const { openai } = require('./embeddingService');
const { generateEmbedding } = require('./embeddingService');
const { getDocumentsTextOnDemand } = require('./documentProcessor');

// Constants
const AI_TEMPERATURE = 0.3;
const AI_MAX_TOKENS = 2000;

/**
 * Retrieve relevant documents for a query using vector similarity
 *
 * @param {number} classId - ID of the class to search within
 * @param {string} query - User's search query
 * @returns {Promise<Array>} Array of relevant document chunks
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
  } catch (error) {
    console.error('Error retrieving documents:', error);
    return [];
  }
}

/**
 * Smart hierarchical retrieval: First find relevant documents, then search within them
 *
 * @param {number} classId - ID of the class to search within
 * @param {string} query - User's search query
 * @param {number} limit - Maximum number of chunks to return
 * @returns {Promise<Array>} Array of relevant document chunks
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

  } catch (error) {
    console.error('Error in smart hierarchical retrieval:', error);
    console.log('🔄 Falling back to basic retrieval...');
    return await retrieveRelevantDocuments(classId, query);
  }
}

/**
 * Adaptive context window based on class size and content
 *
 * @param {number} classId - ID of the class to analyze
 * @returns {Promise<Object>} Context strategy with maxChunks and charsPerChunk
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

  } catch (error) {
    console.error('Error getting adaptive context strategy:', error);
    return { maxChunks: 5, charsPerChunk: 1500, reasoning: 'Default fallback' };
  }
}

/**
 * Enhanced retrieve function with all optimizations
 *
 * @param {number} classId - ID of the class to search within
 * @param {string} query - User's search query
 * @returns {Promise<Array>} Array of optimized relevant chunks
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

  } catch (error) {
    console.error('Error in optimized retrieval:', error);
    // Final fallback to original function
    return await retrieveRelevantDocuments(classId, query);
  }
}

/**
 * Generate AI response using RAG
 *
 * @param {number} classId - ID of the class context
 * @param {string} question - User's question
 * @param {string} aiName - Name of the AI assistant
 * @returns {Promise<Object>} Result with AI response and metadata
 */
async function generateAIResponse(classId, question, aiName = 'Andy') {
  try {
    // Get class information (name and code) for context
    const classResult = await pool.query(
      'SELECT code, name FROM classes WHERE id = $1',
      [classId]
    );
    const className = classResult.rows[0]?.name || 'this course';
    const classCode = classResult.rows[0]?.code || '';

    // Use optimized hierarchical retrieval
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

    const systemPrompt = `You are a knowledgeable academic AI assistant helping students with ${classCode ? `${classCode} - ${className}` : className}.

CURRENT CONTEXT:
- Today is: ${dateString}
- Current time: ${timeString}
- Year: ${currentDate.getFullYear()}
- Course: ${classCode ? `${classCode} - ${className}` : className}

Response priorities:
1. FIRST: Check if the question relates to uploaded course materials - if so, prioritize that information
2. SECOND: If no course materials are relevant, answer using your general knowledge
3. Always be helpful and direct regardless of the question type

Core principles:
- Be direct and concise - get straight to the point
- If you don't know something, simply say "I don't know" rather than guessing
- Answer questions directly without unnecessary context
- For simple questions, give simple answers using the current context above
- Be honest about your limitations
- Use the current date/time information provided above for any time-related questions

CRITICAL FORMATTING RULES:
- NEVER use markdown headers (###, ##, #) - they look unprofessional
- Use **bold text** for key terms, section titles, and important headings instead of headers
- Use bullet points (with - symbol) and numbered lists to organize information clearly
- Keep formatting clean and professional like modern AI assistants
- Be thorough and detailed in your analysis
- Structure responses with clear organization

For course-related questions:
- Reference course materials when available and relevant
- Explain concepts clearly and practically
- Provide detailed analysis and examples from the materials when helpful
- Use **bold text** to highlight key findings and section titles

For general questions:
- Answer directly using your knowledge and the current context provided above
- For date/time questions, use the exact current date/time information provided
- Don't deflect to course-related topics unless truly relevant
- Be helpful across all subjects: science, math, current events, practical advice, etc.
- For real-time information you don't have (weather, breaking news, stock prices), honestly say "I don't know"

For technical content:
- For diagrams, automata, or mathematical figures, provide complete LaTeX/TikZ code
- Use proper academic notation and clear labeling
- Make visual representations accurate and publication-quality`;

    const userPrompt = context.length > 0
      ? `Course materials available for ${classCode ? `${classCode} - ${className}` : className}:
${context}

Question: "${question}"

Provide a detailed, well-structured answer. Use course materials if relevant, otherwise use general knowledge.

Remember to format with:
- **Bold text** for key terms and section titles (NOT ### headers)
- Bullet points and lists for clear organization
- Thorough, detailed analysis when appropriate`
      : `Question: "${question}"

Provide a clear, well-structured answer using your general knowledge.

Remember to format with:
- **Bold text** for key terms and section titles (NOT ### headers)
- Bullet points and lists for clear organization
- Clean, professional formatting`;

    // Call OpenAI with Claude-like settings
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
      stream: false
    });

    return {
      success: true,
      response: response.choices[0].message.content,
      documentsUsed: relevantDocs.map(d => d.filename)
    };
  } catch (error) {
    console.error('Error generating AI response:', error);

    if (error.code === 'insufficient_quota') {
      return {
        success: false,
        response: "Sorry, the OpenAI API quota has been exceeded. Please check your API key and billing."
      };
    }

    if (error.status === 401) {
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

module.exports = {
  retrieveRelevantDocuments,
  smartHierarchicalRetrieval,
  getAdaptiveContextStrategy,
  retrieveRelevantDocumentsOptimized,
  generateAIResponse
};
