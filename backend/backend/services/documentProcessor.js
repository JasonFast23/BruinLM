/**
 * Document processing service
 * Handles document processing, chunking, and storage with embeddings
 */

const pool = require('../db');
const { extractTextFromFile } = require('./documentExtractor');
const { generateEmbedding, splitIntoChunks } = require('./embeddingService');
const { generateAndStoreDocumentSummary } = require('./summaryService');

// Constants
const DEFAULT_DOCUMENT_LIMIT = 5;
const DEFAULT_CHARS_PER_DOCUMENT = 3000;
const EMBEDDING_RATE_LIMIT_DELAY_MS = 100;

/**
 * On-demand document text: use stored content if present, otherwise extract from file now.
 * This enables instant Q&A without waiting for indexing.
 *
 * @param {number} classId - The ID of the class to fetch documents for
 * @param {number} limit - Maximum number of documents to retrieve
 * @param {number} charactersPerDocument - Maximum characters to include from each document
 * @returns {Promise<Array>} Array of document objects with filename and content
 */
async function getDocumentsTextOnDemand(classId, limit = DEFAULT_DOCUMENT_LIMIT, charactersPerDocument = DEFAULT_CHARS_PER_DOCUMENT) {
  try {
    const queryResult = await pool.query(
      `SELECT id, filename, filepath, content
       FROM documents
       WHERE class_id = $1
       ORDER BY uploaded_at DESC
       LIMIT $2`,
      [classId, limit]
    );

    const documents = [];
    for (const row of queryResult.rows) {
      let textContent = row.content;

      // Extract on-demand from the source file if content is missing or too short
      if (!textContent || textContent.trim().length < 10) {
        try {
          console.log(`⚡ On-demand extraction for ${row.filename}`);
          textContent = await extractTextFromFile(row.filepath);
        } catch (extractionError) {
          console.log(`⚠️ Could not extract text for ${row.filename}`);
          textContent = '';
        }
      }

      // Add document if it has meaningful content
      if (textContent && textContent.trim().length > 0) {
        documents.push({
          filename: row.filename,
          content: textContent.slice(0, charactersPerDocument)
        });
      }

      // Stop if we've reached the limit
      if (documents.length >= limit) break;
    }

    console.log(`📚 Retrieved ${documents.length} documents instantly for AI query`);
    return documents;
  } catch (error) {
    console.error('Error getting on-demand document text:', error);
    return [];
  }
}

/**
 * Process and store document with embeddings
 *
 * @param {number} documentId - ID of the document to process
 * @returns {Promise<Object>} Processing result with success status and details
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

    // Mark processing start
    try {
      await pool.query(
        'UPDATE documents SET processing_status = $1, last_error = NULL WHERE id = $2',
        ['processing', documentId]
      );
    } catch (_) {
      // Ignore update errors
    }

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
        await new Promise(resolve => setTimeout(resolve, EMBEDDING_RATE_LIMIT_DELAY_MS));
      }
    }

    console.log(`✅ Document ${documentId} processed successfully with ${chunks.length} chunks`);

    try {
      await pool.query(
        'UPDATE documents SET chunks_count = $1, processing_status = $2, processed_at = NOW() WHERE id = $3',
        [chunks.length, 'processed', documentId]
      );
    } catch (_) {
      // Ignore update errors
    }

    // Generate document summary for hierarchical retrieval
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
  } catch (error) {
    console.error('Error processing document:', error);

    try {
      await pool.query(
        'UPDATE documents SET processing_status = $1, last_error = $2 WHERE id = $3',
        ['failed', error.message?.slice(0, 500) || 'error', documentId]
      );
    } catch (_) {
      // Ignore update errors
    }

    return { success: false, error: error.message };
  }
}

module.exports = {
  getDocumentsTextOnDemand,
  processDocument
};
