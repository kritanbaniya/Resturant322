/**
 * llm service
 * handles communication with ollama cloud llm
 */

import { Ollama } from 'ollama';
import { removeEmojis } from './textUtils.js';

/**
 * validate memory response to catch hallucinations
 * @param {string} answer - llm response
 * @param {string} prompt - user prompt/question
 * @param {array} history - conversation history array
 * @returns {string} - validated/corrected answer
 */
function validateMemoryResponse(answer, prompt, history) {
  const lowerPrompt = prompt.toLowerCase();
  const lowerAnswer = answer.toLowerCase();
  
  // check if this is a memory question
  const isNameQuestion = lowerPrompt.includes("what's my name") || 
                         lowerPrompt.includes("what is my name") ||
                         lowerPrompt.includes("who am i");
  
  const isMemoryQuestion = lowerPrompt.includes("what did i ask") ||
                           lowerPrompt.includes("what did you say") ||
                           lowerPrompt.includes("what was i talking") ||
                           lowerPrompt.includes("what did we discuss");
  
  if (!isNameQuestion && !isMemoryQuestion) {
    return answer; // not a memory question, return as-is
  }
  
  // extract history text for searching
  const historyText = history.map(m => m.content).join(' ').toLowerCase();
  
  // check for name question
  if (isNameQuestion) {
    // try to extract name from history
    const namePatterns = [
      /my name is ([a-z]+)/i,
      /i'm ([a-z]+)/i,
      /i am ([a-z]+)/i,
      /call me ([a-z]+)/i,
      /name is ([a-z]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = historyText.match(pattern);
      if (match && match[1]) {
        const extractedName = match[1];
        // if llm said name is not found/available but we have the name, correct it
        const nameNotFoundPatterns = [
          "don't see",
          "don't know",
          "not recorded",
          "not provided",
          "not available",
          "not in",
          "don't have",
          "i don't have",
          "i don't know",
          "no information",
          "can't find"
        ];
        
        const nameNotFound = nameNotFoundPatterns.some(pattern => lowerAnswer.includes(pattern));
        if (nameNotFound) {
          return `your name is ${extractedName}.`;
        }
        // if llm used placeholder, replace it
        // check for various placeholder patterns
        const placeholderPatterns = [
          /\[name/i,
          /\[name_from_conversation_history\]/i,
          /placeholder/i,
          /\[.*name.*\]/i,  // catch any bracket with "name"
          /name_from_conversation_history/i
        ];
        
        const hasPlaceholder = placeholderPatterns.some(pattern => pattern.test(lowerAnswer));
        if (hasPlaceholder) {
          return `your name is ${extractedName}.`;
        }
      }
    }
  }
  
  // check for memory question about food/dishes
  if (isMemoryQuestion && (lowerPrompt.includes('food') || lowerPrompt.includes('dish') || lowerPrompt.includes('menu'))) {
    // check for common hallucinated dishes not in history
    const hallucinatedDishes = [
      'chicken tikka masala',
      'tikka masala',
      'thali',
      'butter chicken',
      'biryani'
    ];
    
    const hallucinated = hallucinatedDishes.some(dish => 
      lowerAnswer.includes(dish) && !historyText.includes(dish)
    );
    
    if (hallucinated) {
      // find actual food question from history
      const foodQuestions = history.filter(m => 
        m.role === 'user' && 
        (m.content.toLowerCase().includes('food') || 
         m.content.toLowerCase().includes('menu') ||
         m.content.toLowerCase().includes('sell') ||
         m.content.toLowerCase().includes('dish'))
      );
      
      if (foodQuestions.length > 0) {
        const lastFoodQuestion = foodQuestions[foodQuestions.length - 1].content;
        return `you asked: "${lastFoodQuestion}"`;
      }
    }
    
    // check for generic responses that don't quote the exact question
    // if answer is too generic (like "you asked about the food we sell"), extract exact question
    const genericPatterns = [
      /you asked about (the|our) (food|menu|dishes?)/i,
      /you asked (about|regarding) (the|our) (food|menu|dishes?)/i
    ];
    
    if (genericPatterns.some(pattern => pattern.test(lowerAnswer))) {
      const foodQuestions = history.filter(m => 
        m.role === 'user' && 
        (m.content.toLowerCase().includes('food') || 
         m.content.toLowerCase().includes('menu') ||
         m.content.toLowerCase().includes('sell') ||
         m.content.toLowerCase().includes('dish'))
      );
      
      if (foodQuestions.length > 0) {
        const lastFoodQuestion = foodQuestions[foodQuestions.length - 1].content;
        return `you asked: "${lastFoodQuestion}"`;
      }
    }
  }
  
  // check for general memory question
  if (isMemoryQuestion) {
    // check if answer mentions restaurant stories not in history
    const storyKeywords = ['founded', 'founder', 'raju', 'started', 'began', 'story'];
    const hasStory = storyKeywords.some(keyword => 
      lowerAnswer.includes(keyword) && !historyText.includes(keyword)
    );
    
    if (hasStory) {
      // find actual question from history
      const userQuestions = history.filter(m => m.role === 'user');
      if (userQuestions.length > 0) {
        const lastQuestion = userQuestions[userQuestions.length - 1].content;
        return `you asked: "${lastQuestion}"`;
      }
    }
  }
  
  // check for restaurant story hallucination when "tell me a story" is asked
  const isStoryRequest = lowerPrompt.includes('tell me a story') || 
                         lowerPrompt.includes('tell me a tale') ||
                         lowerPrompt.includes('tell me a joke');
  
  if (isStoryRequest) {
    // check if story mentions the restaurant name - any story mentioning restaurant is a hallucination
    const restaurantNamePatterns = [
      /himalayan house/i,
      /the himalayan house/i,
      /himalayan house restaurant/i
    ];
    
    const mentionsRestaurant = restaurantNamePatterns.some(pattern => pattern.test(lowerAnswer));
    
    // also check for restaurant-specific story keywords
    const restaurantStoryKeywords = [
      'ranjit', 'founder', 'founded', 'opened', 'immigrated', 
      'restaurant', 'chef', 'opened the restaurant',
      'ingredients imported', 'from the himalayas'
    ];
    
    const hasRestaurantKeywords = restaurantStoryKeywords.some(keyword => 
      lowerAnswer.includes(keyword) && !historyText.includes(keyword)
    );
    
    // if story mentions restaurant name OR has restaurant-specific keywords, it's a hallucination
    if (mentionsRestaurant || (hasRestaurantKeywords && lowerAnswer.includes('restaurant'))) {
      // this is a restaurant story hallucination - return safe response
      return "i'd be happy to tell you a story, but i don't have specific stories about the restaurant's history. would you like to hear a general story or joke instead?";
    }
  }
  
  return answer; // no issues detected
}

/**
 * call ollama cloud llama3.2:3b for general (non-restaurant) questions
 * @param {string} prompt - user prompt/question
 * @param {array} history - conversation history array of { role: 'user'|'assistant', content: string }
 * @param {string} systemPrompt - system prompt text
 * @param {string} modelName - ollama model name (default: 'llama3.2:3b')
 * @param {object} recentKbHit - recent kb hit from history (optional) { kbItem, answer }
 * @returns {promise<object>} - { answer: string, responseTime: number }
 */
export async function callLLM(prompt, history = [], systemPrompt, modelName = 'llama3.2:3b', recentKbHit = null) {
  const start = Date.now();

  // get api key from environment variable
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    console.error('[llm] error: OLLAMA_API_KEY environment variable is required for Ollama Cloud');
    throw new Error('OLLAMA_API_KEY environment variable is required for Ollama Cloud');
  }

  // validate and fix model name - common issue: old local model names don't work on cloud
  let actualModelName = modelName;
  if (modelName === 'mistral:instruct') {
    console.warn('[llm] warning: model name "mistral:instruct" is not available on Ollama Cloud');
    console.warn('[llm] auto-fixing to "mistral" (remove ":instruct" suffix)');
    actualModelName = 'mistral';
  }

  // build messages array for ollama cloud chat api
  // format: [{ role: 'system'|'user'|'assistant', content: string }]
  const messages = [];
  
  // add system prompt with kb context if available
  let enhancedSystemPrompt = systemPrompt ? systemPrompt.trim() : '';
  
  // if there was a recent kb hit, inform the llm about it
  if (recentKbHit && recentKbHit.kbItem) {
    enhancedSystemPrompt += `\n\nNOTE: The previous response used information from the knowledge base (${recentKbHit.kbItem}). If the user is asking a follow-up question, you may reference this information, but do not make up additional restaurant details.`;
  }
  
  if (enhancedSystemPrompt) {
    messages.push({
      role: 'system',
      content: enhancedSystemPrompt
    });
  }
  
  // add conversation history (already in correct format)
  // limit to last 10 messages to prevent context overflow
  const recentHistory = history.slice(-10);
  recentHistory.forEach(msg => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
  });
  
  // add current user message
  messages.push({
    role: 'user',
    content: prompt
  });

  // log the messages being sent to llm
  console.log('[llm] ====== ollama cloud chat api request ======');
  console.log('[llm] endpoint: https://ollama.com/api/chat');
  console.log('[llm] requested model:', modelName);
  console.log('[llm] actual model:', actualModelName);
  console.log('[llm] api key present:', apiKey ? 'yes (hidden)' : 'no');
  console.log('[llm] messages count:', messages.length);
  console.log('[llm] history array length:', history.length);
  console.log('[llm] messages:', JSON.stringify(messages, null, 2));
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
    console.log('[llm] response keys:', response ? Object.keys(response) : 'null');
    console.log('[llm] response:', JSON.stringify(response, null, 2));
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
      console.error('[llm] note: local model names (like "mistral:instruct") may not work on cloud');
      console.error('[llm] ===================================');
    }
    
    throw ollamaError;
  }

  const end = Date.now();
  const responseTime = end - start;

  console.log('[llm] ====== response validation ======');
  console.log('[llm] response exists:', !!response);
  console.log('[llm] response.message exists:', !!(response && response.message));
  console.log('[llm] response.message.content exists:', !!(response && response.message && response.message.content));
  console.log('[llm] response.message.content type:', response && response.message && response.message.content ? typeof response.message.content : 'n/a');
  console.log('[llm] response.message.content value:', response && response.message && response.message.content ? response.message.content.substring(0, 200) : 'n/a');
  if (response && (!response.message || !response.message.content)) {
    console.error('[llm] full response object:', JSON.stringify(response, null, 2));
  }
  console.log('[llm] =================================');

  // ollama cloud chat api returns { message: { content: string, role: string }, ... }
  if (!response || !response.message || !response.message.content) {
    console.error('[llm] error: invalid response from ollama cloud');
    console.error('[llm] response data:', JSON.stringify(response, null, 2));
    return { answer: "sorry, i couldn't generate a response.", responseTime };
  }

  // remove emojis from response as a safety measure
  let cleanedAnswer = removeEmojis(response.message.content.trim());
  
  // validate memory response to catch hallucinations
  cleanedAnswer = validateMemoryResponse(cleanedAnswer, prompt, history);
  
  return { answer: cleanedAnswer, responseTime };
}
