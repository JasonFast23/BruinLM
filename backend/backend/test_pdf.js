// Simple PDF extraction test
const fs = require('fs');
const path = require('path');

// Try to import pdf-parse with fallback
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  console.log('✅ PDF-parse loaded successfully');
} catch (err) {
  console.error('❌ Failed to load pdf-parse:', err.message);
  pdfParse = null;
}

async function testPdfExtraction() {
  const uploadsDir = './uploads';
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf')).sort().reverse();
  
  if (files.length === 0) {
    console.log('No PDF files found');
    return;
  }
  
  const testFile = path.join(uploadsDir, files[0]);
  console.log('Testing file:', testFile);
  
  if (!pdfParse) {
    console.log('❌ PDF parser not available');
    return;
  }
  
  try {
    const dataBuffer = fs.readFileSync(testFile);
    console.log(`🔍 PDF buffer size: ${dataBuffer.length} bytes`);
    
    // Handle different import patterns
    let parser = pdfParse;
    if (typeof pdfParse === 'object' && pdfParse.default) {
      parser = pdfParse.default;
    }
    
    if (typeof parser !== 'function') {
      console.error('❌ pdfParse is not a function:', typeof parser);
      return;
    }
    
    const result = await parser(dataBuffer);
    const text = result.text || '';
    
    console.log('✅ Extracted text length:', text.length);
    if (text.length > 0) {
      console.log('✅ First 300 characters:');
      console.log(text.substring(0, 300));
      console.log('...');
    } else {
      console.log('❌ No text extracted');
    }
    
  } catch (err) {
    console.error('❌ Extraction failed:', err);
  }
}

testPdfExtraction();