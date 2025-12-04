/**
 * Document summary generation service
 * Handles generation of document summaries and key topics extraction
 */

const pool = require('../db');
const { openai } = require('./embeddingService');
const { generateEmbedding } = require('./embeddingService');
const { extractTextFromFile } = require('./documentExtractor');

// Constants
const SUMMARY_MAX_TOKENS = 400;
const TOPICS_MAX_TOKENS = 100;
const ISOLATED_SUMMARY_MAX_TOKENS = 600;
const ISOLATED_SUMMARY_TEMPERATURE = 0.2;

/**
 * Generate a comprehensive summary of a document for hierarchical retrieval
 *
 * @param {string} content - Document content to summarize
 * @param {string} filename - Name of the document file
 * @returns {Promise<string>} Generated summary
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
      temperature: 0.3,
      max_tokens: SUMMARY_MAX_TOKENS
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating document summary:', error);
    // Fallback to truncated content
    return content.substring(0, 1000) + '...';
  }
}

/**
 * Generate an isolated document summary for display (no classroom context contamination)
 * This ensures identical summaries regardless of what other documents exist in the classroom
 *
 * @param {string} content - Document content to summarize
 * @param {string} filename - Name of the document file
 * @returns {Promise<string>} Generated isolated summary
 */
async function generateIsolatedDocumentSummary(content, filename) {
  try {
    const summaryPrompt = `Please provide a clean, comprehensive summary of this document.

FORMATTING REQUIREMENTS:
- Use **bold text** for section titles and key terms
- Organize content with clear **bold section headings**
- Write in clean, structured format with proper paragraph spacing
- NO markdown headers (###, ##) - use **bold text** for headings instead
- Start directly with content - no title or "Summary of..." header

Structure your response with these sections:
- **Key Concepts**: Main topics and definitions
- **Important Details**: Core explanations and principles
- **Examples**: Practical applications or illustrations mentioned
- **Learning Objectives**: Study goals or takeaways

Keep it clean and well-organized like modern AI assistants, but with clear structure.

Document: ${filename}
Content: ${content}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: ISOLATED_SUMMARY_TEMPERATURE,
      max_tokens: ISOLATED_SUMMARY_MAX_TOKENS
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating isolated document summary:', error);
    // Fallback to basic summary
    return `**Document Summary**\n\nThis document contains ${Math.round(content.length / 5)} words of content. Unable to generate detailed summary at this time.`;
  }
}

/**
 * Extract key topics from document content using AI
 *
 * @param {string} content - Document content to extract topics from
 * @returns {Promise<Array<string>>} Array of key topics
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
      max_tokens: TOPICS_MAX_TOKENS
    });

    const topicsText = response.choices[0].message.content;
    return topicsText.split(',').map(topic => topic.trim()).filter(topic => topic.length > 0);
  } catch (error) {
    console.error('Error extracting topics:', error);
    return [];
  }
}

/**
 * Generate and store document summary with embedding for hierarchical retrieval
 *
 * @param {number} documentId - ID of the document to summarize
 * @returns {Promise<Object>} Result with success status and summary details
 */
async function generateAndStoreDocumentSummary(documentId) {
  try {
    // Check if summary already exists in the table
    const existingCheck = await pool.query(
      'SELECT COUNT(*) as count FROM document_summaries WHERE document_id = $1',
      [documentId]
    );

    if (parseInt(existingCheck.rows[0].count) > 0) {
      console.log(`⏭️  Summary already exists for document ${documentId}, skipping`);
      return { success: false, message: 'Summary already exists' };
    }

    // Get document info and content
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return { success: false, message: 'Document not found' };
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

  } catch (error) {
    console.error('Error generating document summary:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  generateDocumentSummary,
  generateIsolatedDocumentSummary,
  extractKeyTopics,
  generateAndStoreDocumentSummary
};
