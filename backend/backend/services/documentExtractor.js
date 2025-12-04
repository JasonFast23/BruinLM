/**
 * Document text extraction service
 * Handles extraction of text content from various file formats (PDF, TXT, DOCX)
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Constants
const PREVIEW_LENGTH = 200;
const MIN_PREVIEW_LENGTH = 100;

/**
 * Extract text content from uploaded file based on file type
 *
 * @param {string} filepath - Path to the file to extract text from
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromFile(filepath) {
  const fileExtension = path.extname(filepath).toLowerCase();

  try {
    // Handle text files
    if (fileExtension === '.txt') {
      return fs.readFileSync(filepath, 'utf-8');
    }

    // Handle PDF files
    if (fileExtension === '.pdf') {
      const pdfDataBuffer = fs.readFileSync(filepath);
      console.log(`🔍 PDF buffer size: ${pdfDataBuffer.length} bytes`);

      const parseResult = await pdfParse(pdfDataBuffer);
      const extractedText = parseResult.text || '';
      console.log(`✅ PDF text extracted: ${extractedText.length} characters`);

      // Show preview for debugging if text is substantial
      if (extractedText.length > MIN_PREVIEW_LENGTH) {
        console.log(`📄 Preview: ${extractedText.substring(0, PREVIEW_LENGTH)}...`);
      }

      return extractedText;
    }

    // Handle Word documents (future implementation)
    if (fileExtension === '.doc' || fileExtension === '.docx') {
      // Optional: integrate 'mammoth' for DOCX extraction in future
      return '';
    }

    // Unsupported file type
    return '';
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

module.exports = {
  extractTextFromFile
};
