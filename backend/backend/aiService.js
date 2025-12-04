/**
 * AI Service - Main entry point
 * This module serves as a facade, importing and re-exporting functions from specialized service modules
 * to maintain backward compatibility with existing code.
 *
 * Service modules:
 * - documentExtractor: Text extraction from files (PDF, TXT, DOCX)
 * - embeddingService: Embedding generation and text chunking
 * - documentProcessor: Document processing and storage
 * - summaryService: Document summary generation
 * - ragService: RAG retrieval and AI response generation
 * - streamingService: Streaming AI responses
 */

// Import from specialized service modules
const { extractTextFromFile } = require('./services/documentExtractor');
const { generateEmbedding, splitIntoChunks } = require('./services/embeddingService');
const {
  getDocumentsTextOnDemand,
  processDocument
} = require('./services/documentProcessor');
const {
  generateDocumentSummary,
  generateIsolatedDocumentSummary,
  extractKeyTopics,
  generateAndStoreDocumentSummary
} = require('./services/summaryService');
const {
  retrieveRelevantDocuments,
  smartHierarchicalRetrieval,
  getAdaptiveContextStrategy,
  retrieveRelevantDocumentsOptimized,
  generateAIResponse
} = require('./services/ragService');
const {
  generateAIResponseStream
} = require('./services/streamingService');

// Re-export all functions for backward compatibility
module.exports = {
  // Document extraction
  extractTextFromFile,

  // Embedding and chunking
  generateEmbedding,
  splitIntoChunks,

  // Document processing
  getDocumentsTextOnDemand,
  processDocument,

  // Summary generation
  generateDocumentSummary,
  generateIsolatedDocumentSummary,
  extractKeyTopics,
  generateAndStoreDocumentSummary,

  // RAG and retrieval
  retrieveRelevantDocuments,
  smartHierarchicalRetrieval,
  getAdaptiveContextStrategy,
  retrieveRelevantDocumentsOptimized,
  generateAIResponse,

  // Streaming
  generateAIResponseStream
};
