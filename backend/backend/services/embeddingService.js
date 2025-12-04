/**
 * Embedding generation service
 * Handles generation of embeddings using OpenAI's API and text chunking for RAG
 */

const OpenAI = require('openai');

// Constants
const EMBEDDING_TEXT_LIMIT = 8000;
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for text using OpenAI's embedding model
 *
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<Array|null>} Embedding vector or null if generation fails
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.substring(0, EMBEDDING_TEXT_LIMIT)
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Split text into overlapping chunks for better RAG (Retrieval-Augmented Generation)
 *
 * @param {string} text - Text to split into chunks
 * @param {number} chunkSize - Size of each chunk in characters
 * @param {number} overlapSize - Number of overlapping characters between chunks for context continuity
 * @returns {Array<string>} Array of text chunks
 */
function splitIntoChunks(text, chunkSize = DEFAULT_CHUNK_SIZE, overlapSize = DEFAULT_CHUNK_OVERLAP) {
  const chunks = [];
  let startPosition = 0;

  while (startPosition < text.length) {
    const endPosition = Math.min(startPosition + chunkSize, text.length);
    const chunk = text.substring(startPosition, endPosition);
    chunks.push(chunk);

    // Move start position forward with overlap for context continuity
    startPosition += chunkSize - overlapSize;
  }

  return chunks;
}

module.exports = {
  generateEmbedding,
  splitIntoChunks,
  openai
};
