/**
 * memory manager
 * handles conversation history formatting
 */

/**
 * format conversation history for llm prompt
 * @param {array} history - array of { role: 'user'|'assistant', content: string }
 * @returns {string} - formatted history string
 */
export function formatConversationHistory(history) {
  if (!history || history.length === 0) {
    return '';
  }
  
  // limit to last 10 messages to prevent context overflow
  // take the last 10, but ensure we don't cut off a 'user' if possible
  const recentHistory = history.slice(-10);
  
  let formatted = '\n\n=== CONVERSATION HISTORY_START ===\n';
  
  recentHistory.forEach((msg, index) => {
    // simple clear format: Role: Content
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    formatted += `${role}: ${msg.content}\n`;
  });

  formatted += '=== CONVERSATION HISTORY_END ===\n\n';
  
  return formatted;
}
