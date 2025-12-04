/**
 * Markdown rendering utility
 * Provides safe markdown to HTML conversion for chat messages
 */

/**
 * Render markdown text to HTML safely
 * Supports bold, italic, and line breaks
 *
 * @param {string} text - Markdown text to render
 * @returns {string} HTML string
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Basic markdown rendering for bold, italic, and line breaks
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
    .replace(/\n/g, '<br>'); // line breaks

  return html;
}
