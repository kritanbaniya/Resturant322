/**
 * llm service
 * handles communication with the ollama llm
 */

import fetch from 'node-fetch';
import { formatConversationHistory } from './memoryManager.js';
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
 * call local ollama mistral:instruct for general (non-restaurant) questions
 * @param {string} prompt - user prompt/question
 * @param {array} history - conversation history array of { role: 'user'|'assistant', content: string }
 * @param {string} systemPrompt - system prompt text
 * @param {string} modelName - ollama model name (default: 'mistral:instruct')
 * @returns {promise<object>} - { answer: string, responseTime: number }
 */
export async function callLLM(prompt, history = [], systemPrompt, modelName = 'mistral:instruct') {
  // format conversation history for context
  const historyContext = formatConversationHistory(history);
  
  // build prompt with proper spacing
  // ensure newlines between system prompt, history, and user message
  let fullPrompt = systemPrompt.trim();
  
  // add history if it exists (historyContext already includes newlines)
  if (historyContext && historyContext.trim()) {
    fullPrompt += historyContext; // historyContext already has leading/trailing newlines
  } else {
    // if no history, add a newline before user message
    fullPrompt += '\n';
  }
  
  // add user message with proper formatting
  fullPrompt += `user: ${prompt}\nassistant:`;

  // log the complete prompt being sent to llm
  console.log('====== complete llm prompt ======');
  console.log(fullPrompt);
  console.log('================================');
  console.log('history array length:', history.length);
  console.log('history array:', JSON.stringify(history, null, 2));

  const start = Date.now();

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      prompt: fullPrompt,
      stream: false,
      num_predict: 200
    })
  });

  const data = await response.json();
  const end = Date.now();
  const responseTime = end - start;

  if (!data || !data.response) {
    return { answer: "sorry, i couldn't generate a response.", responseTime };
  }

  // remove emojis from response as a safety measure
  let cleanedAnswer = removeEmojis(data.response.trim());
  
  // validate memory response to catch hallucinations
  cleanedAnswer = validateMemoryResponse(cleanedAnswer, prompt, history);
  
  return { answer: cleanedAnswer, responseTime };
}
