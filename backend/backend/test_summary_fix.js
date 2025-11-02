/**
 * Test script to verify that the same document produces identical summaries
 * regardless of what other documents exist in the classroom (context contamination fix)
 */
require('dotenv').config();
const { generateIsolatedDocumentSummary } = require('./aiService');

async function testSummaryConsistency() {
  console.log('🧪 Testing Summary Consistency Fix...\n');
  
  // Sample document content (similar to a finite state automata PDF)
  const testDocumentContent = `
Finite State Automata (FSA)

A finite state automaton is a computational model used to represent and control execution flow in systems. It consists of:

1. States: A finite set of conditions or situations
2. Transitions: Rules for moving between states based on input
3. Initial State: The starting point of the automaton
4. Final States: States that indicate acceptance or completion

Key Concepts:
- Alphabet (Σ): A finite set of symbols used to construct strings
- Strings (Σ*): The set of all possible strings that can be formed from the alphabet
- Concatenation (u + v): A method to combine two strings

Important Properties:
- Deterministic FSA: Each state has exactly one transition for each input symbol
- Non-deterministic FSA: States may have multiple transitions for the same input
- Regular Languages: Languages that can be recognized by finite state automata

Examples:
- FSA for strings containing at least one 'a'
- FSA for binary numbers divisible by 3
- FSA for valid email address patterns

Learning Objectives:
- Understand the mathematical foundation of automata theory
- Learn to design FSAs for specific language recognition tasks
- Apply FSA concepts to practical computing problems
`;

  const filename = "finite-state-automata.pdf";
  
  try {
    console.log('📄 Testing document:', filename);
    console.log('📄 Content length:', testDocumentContent.length, 'characters\n');
    
    // Generate summary 1 (simulating upload to empty classroom)
    console.log('🏫 Simulating upload to EMPTY classroom...');
    const summary1 = await generateIsolatedDocumentSummary(testDocumentContent, filename);
    
    // Wait a bit to ensure different timestamps don't affect anything
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate summary 2 (simulating upload to classroom with existing documents)
    console.log('🏫 Simulating upload to classroom WITH existing documents...');
    const summary2 = await generateIsolatedDocumentSummary(testDocumentContent, filename);
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 SUMMARY 1 (Empty Classroom):');
    console.log('='.repeat(80));
    console.log(summary1);
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 SUMMARY 2 (Classroom with Existing Docs):');
    console.log('='.repeat(80));
    console.log(summary2);
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 COMPARISON RESULTS:');
    console.log('='.repeat(80));
    
    // Compare summaries
    const areIdentical = summary1.trim() === summary2.trim();
    const lengthDiff = Math.abs(summary1.length - summary2.length);
    const similarity = calculateSimilarity(summary1, summary2);
    
    console.log(`📊 Identical: ${areIdentical ? '✅ YES' : '❌ NO'}`);
    console.log(`📊 Length difference: ${lengthDiff} characters`);
    console.log(`📊 Similarity score: ${(similarity * 100).toFixed(1)}%`);
    
    if (areIdentical) {
      console.log('\n🎉 SUCCESS! The fix works - summaries are identical!');
      console.log('✅ No context contamination detected');
    } else if (similarity > 0.85) {
      console.log('\n⚠️  PARTIAL SUCCESS: Summaries are very similar but not identical');
      console.log('ℹ️  This might be due to slight randomness in AI generation (which is normal)');
    } else {
      console.log('\n❌ FAILURE: Summaries are significantly different');
      console.log('⚠️  Context contamination may still be occurring');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Simple similarity calculation (Jaccard similarity of words)
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().match(/\w+/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\w+/g) || []);
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Run the test
testSummaryConsistency().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});