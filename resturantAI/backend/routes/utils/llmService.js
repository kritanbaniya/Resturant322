/**
 * llm service
 * handles communication with ollama cloud llm
 */

import { Ollama } from 'ollama';
import { removeEmojis } from './textUtils.js';

/**
 * call ollama cloud llama3.2:3b
 * @param {string} prompt - user prompt/question
 * @param {array} history - conversation history array of { role: 'user'|'assistant', content: string }
 * @param {string} systemPrompt - system prompt text
 * @param {string} modelName - ollama model name (default: 'llama3.2:3b')
 * @param {array} kbFacts - kb facts array (optional) array of fact strings
 * @returns {promise<object>} - { answer: string, responseTime: number }
 */
export async function callLLM(prompt, history = [], systemPrompt, modelName = 'llama3.2:3b', kbFacts = null) {
  const start = Date.now();

  // get api key from environment variable
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    console.error('[llm] error: OLLAMA_API_KEY environment variable is required for Ollama Cloud');
    throw new Error('OLLAMA_API_KEY environment variable is required for Ollama Cloud');
  }

  // validate and fix model name
  let actualModelName = modelName;
  if (modelName === 'mistral:instruct') {
    console.warn('[llm] warning: model name "mistral:instruct" is not available on Ollama Cloud');
    console.warn('[llm] auto-fixing to "mistral"');
    actualModelName = 'mistral';
  }

  // build messages array for ollama cloud chat api
  // prompt construction order:
  // 1. system prompt (with kb facts embedded)
  // 2. last 10 messages (conversation history)
  // 3. user message (current prompt)
  const messages = [];
  
  // step 1: add system prompt with kb context if available
  let enhancedSystemPrompt = systemPrompt ? systemPrompt.trim() : '';
  
  // add kb facts to system prompt if provided
  if (kbFacts && Array.isArray(kbFacts) && kbFacts.length > 0) {
    enhancedSystemPrompt += `\n\n=== RELEVANT FACTS FROM KNOWLEDGE BASE ===\n`;
    kbFacts.forEach((fact, idx) => {
      enhancedSystemPrompt += `${idx + 1}. ${fact}\n`;
    });
    enhancedSystemPrompt += `\nIMPORTANT: Use the facts above to answer the user's question. Format your response naturally and conversationally, but ensure all restaurant-specific information comes from these facts. Do not add details not in these facts.`;
  }
  
  if (enhancedSystemPrompt) {
    messages.push({
      role: 'system',
      content: enhancedSystemPrompt
    });
  }
  
  // step 2: add conversation history (limit to last 10 messages)
  const recentHistory = history.slice(-10);
  recentHistory.forEach(msg => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
  });
  
  // step 3: add current user message
  messages.push({
    role: 'user',
    content: prompt
  });

  // log the messages being sent to llm
  console.log('[llm] ====== ollama cloud chat api request ======');
  console.log('[llm] endpoint: https://ollama.com/api/chat');
  console.log('[llm] requested model:', modelName);
  console.log('[llm] actual model:', actualModelName);
  console.log('[llm] messages count:', messages.length);
  console.log('[llm] kb facts count:', kbFacts ? kbFacts.length : 0);
  console.log('[llm] ===========================================');

  // initialize ollama client for cloud api
  const ollama = new Ollama({
    host: 'https://ollama.com',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  let response;
  try {
    response = await ollama.chat({
      model: actualModelName,
      messages: messages,
      stream: false
    });

    console.log('[llm] ====== ollama cloud api response ======');
    console.log('[llm] response received');
    console.log('[llm] =======================================');

  } catch (ollamaError) {
    console.error('[llm] ollama api error:', ollamaError.message);
    console.error('[llm] ollama error stack:', ollamaError.stack);
    if (ollamaError.response) {
      console.error('[llm] error response:', ollamaError.response);
    }
    
    // provide helpful error message for model not found
    if (ollamaError.message && ollamaError.message.includes('not found')) {
      console.error('[llm] ====== model not found error ======');
      console.error('[llm] attempted model:', modelName);
      console.error('[llm] suggestion: check available models with: curl https://ollama.com/api/tags -H "Authorization: Bearer $OLLAMA_API_KEY"');
      console.error('[llm] common cloud models: llama3.2:3b, mistral, llama3:8b, gpt-oss:120b-cloud');
      console.error('[llm] ===================================');
    }
    
    throw ollamaError;
  }

  const end = Date.now();
  const responseTime = end - start;

  // ollama cloud chat api returns { message: { content: string, role: string }, ... }
  if (!response || !response.message || !response.message.content) {
    console.error('[llm] error: invalid response from ollama cloud');
    console.error('[llm] response data:', JSON.stringify(response, null, 2));
    return { answer: "sorry, i couldn't generate a response.", responseTime };
  }

  // remove emojis from response
  const cleanedAnswer = removeEmojis(response.message.content.trim());
  
  return { answer: cleanedAnswer, responseTime };
}
