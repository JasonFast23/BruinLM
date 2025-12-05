/**
 * Streaming AI response service
 * Handles character-by-character streaming of AI responses
 */

const pool = require('../db');
const { openai } = require('./embeddingService');
const { retrieveRelevantDocumentsOptimized } = require('./ragService');
const { getDocumentsTextOnDemand } = require('./documentProcessor');

// Constants
const AI_TEMPERATURE = 0.3;
const AI_MAX_TOKENS = 2000;
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Streaming version of generateAIResponse for character-by-character output
 *
 * @param {number} classId - ID of the class context
 * @param {string} question - User's question
 * @param {string} aiName - Name of the AI assistant
 * @param {AbortController} abortController - Controller for aborting the stream
 * @param {number} messageId - ID of the message being generated
 * @param {Function} isCancelledCallback - Callback to check if message was cancelled
 * @yields {Object} Stream chunks with content and status
 */
async function* generateAIResponseStream(classId, question, aiName = 'Andy', abortController = null, messageId = null, isCancelledCallback = null) {
  try {
    // Get class information (name and code) for context
    const classResult = await pool.query(
      'SELECT code, name FROM classes WHERE id = $1',
      [classId]
    );
    const className = classResult.rows[0]?.name || 'this course';
    const classCode = classResult.rows[0]?.code || '';

    // Use optimized hierarchical retrieval (same as non-streaming)
    console.log(`🤖 Generating streaming AI response for class ${classId}`);

    // Multiple cancellation checks for ChatGPT-like behavior
    const checkCancellation = () => {
      return abortController?.signal.aborted ||
             (isCancelledCallback && isCancelledCallback(messageId));
    };

    // Check for cancellation before starting
    if (checkCancellation()) {
      console.log('🛑 AI generation aborted before starting');
      return;
    }

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

    // Final cancellation check before making OpenAI request
    if (checkCancellation()) {
      console.log('🛑 AI generation aborted before OpenAI request');
      return;
    }

    // Call OpenAI with streaming enabled and abort signal
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
      stream: true
    }, {
      // CRITICAL: Pass the abort signal to the OpenAI request
      signal: abortController?.signal,
      // Add timeout to prevent hanging requests
      timeout: REQUEST_TIMEOUT_MS
    });

    // Yield each chunk as it arrives with ultra-aggressive cancellation checking
    for await (const chunk of stream) {
      // TRIPLE cancellation check - before processing chunk
      if (checkCancellation()) {
        console.log('🛑 AI generation aborted during streaming (pre-chunk)');
        return;
      }

      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        // QUADRUPLE cancellation check - before yielding content
        if (checkCancellation()) {
          console.log('🛑 AI generation aborted before yielding chunk');
          return;
        }

        yield {
          success: true,
          content: content,
          finished: false,
          documentsUsed: relevantDocs.map(d => d.filename)
        };

        // QUINTUPLE cancellation check - after yielding (catches rapid clicks)
        if (checkCancellation()) {
          console.log('🛑 AI generation aborted after yielding chunk');
          return;
        }
      }
    }

    // Signal completion
    yield {
      success: true,
      content: '',
      finished: true,
      documentsUsed: relevantDocs.map(d => d.filename)
    };

  } catch (error) {
    console.error('Error generating streaming AI response:', error);

    // Enhanced abort detection - check multiple abort conditions
    if (error.name === 'AbortError' ||
        error.message?.includes('aborted') ||
        error.code === 'ABORT_ERR' ||
        (abortController?.signal.aborted) ||
        (isCancelledCallback && isCancelledCallback(messageId))) {
      console.log('🛑 AI streaming properly aborted (enhanced detection)');
      return; // Exit generator without yielding anything
    }

    let errorMessage = "Sorry, I encountered an error processing your request. Please try again.";

    if (error.code === 'insufficient_quota') {
      errorMessage = "Sorry, the OpenAI API quota has been exceeded. Please check your API key and billing.";
    } else if (error.status === 401) {
      errorMessage = "Sorry, the OpenAI API key is invalid or not configured. Please contact the administrator.";
    }

    // Only yield error if not cancelled
    const checkCancellation = () => {
      return abortController?.signal.aborted ||
             (isCancelledCallback && isCancelledCallback(messageId));
    };

    if (!checkCancellation()) {
      yield {
        success: false,
        content: errorMessage,
        finished: true
      };
    }
  }
}

module.exports = {
  generateAIResponseStream
};
