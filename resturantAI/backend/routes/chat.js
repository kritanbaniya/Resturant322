/**
 * chat route - text-based chat interface
 * 
 * flow:
 * 1. user sends text message with conversation history
 * 2. normalize message → check kb → llm if needed
 * 3. add to conversation history (from request body)
 * 4. return text response with updated history
 * 
 * important: history is now stored in localStorage on frontend
 * and sent with each request to maintain conversation context
 */

import express from 'express';
import fs from 'fs';
import { normalizeMessage } from './utils/normalize.js';
import { getKbAnswer } from './utils/knowledgeBase.js';
import { callLLM } from './utils/llmService.js';
import { searchKb } from './utils/semanticSearch.js';

/**
 * check if message should skip kb lookup (personal/memory questions)
 * @param {string} text - normalized message text
 * @returns {boolean} - true if should skip kb lookup
 */
function shouldSkipKbLookup(text) {
  const lower = text.toLowerCase();
  
  // personal/identity questions
  const personalPatterns = [
    /^(my name is|i'm|i am|call me|name is) /i,
    /^what'?s? my name$/i,
    /^what is my name$/i,
    /^who am i$/i,
    /^what am i$/i
  ];
  
  // memory questions
  const memoryPatterns = [
    /what (did|do|does) (i|you|we) (ask|asked|say|said|tell|told|mention|mentioned|discuss|discussed)/i,
    /what (was|were) (i|you|we) (talking|discussing|saying|asking) (about|earlier|before)/i,
    /(earlier|before|previously|just now|a moment ago)/i,
    /what (did|do) (i|you) (ask|say|tell|mention) (about|earlier|before)/i,
    /(remind|remember|recall|recap) (me|us) (what|about)/i,
    /what (was|were) (that|this|it) (i|you|we) (asked|said|talked|discussed)/i
  ];
  
  return personalPatterns.some(p => p.test(text)) || 
         memoryPatterns.some(p => p.test(text));
}

/**
 * detect if llm response contains restaurant information from kb
 * @param {string} response - llm response text
 * @param {object} kb - knowledge base object
 * @returns {boolean} - true if kb content detected
 */
function detectKbHitInResponse(response, kb) {
  if (!response || !kb) return false;
  
  const lowerResponse = response.toLowerCase();
  
  // check if response mentions specific menu items
  if (kb.menu && kb.menu.categories) {
    const allMenuItems = [];
    Object.values(kb.menu.categories).forEach(category => {
      if (Array.isArray(category)) {
        category.forEach(item => {
          if (item && typeof item === 'object' && item.name) {
            allMenuItems.push(item.name.toLowerCase());
          } else if (typeof item === 'string') {
            allMenuItems.push(item.toLowerCase());
          }
        });
      }
    });
    
    // check if any menu item is mentioned
    if (allMenuItems.some(item => lowerResponse.includes(item))) {
      return true;
    }
  }
  
  // check if response mentions restaurant name
  if (kb.restaurant && kb.restaurant.name) {
    const restaurantName = kb.restaurant.name.toLowerCase();
    if (lowerResponse.includes(restaurantName)) {
      return true;
    }
  }
  
  // check if response mentions location/address
  if (kb.locations && Array.isArray(kb.locations)) {
    for (const loc of kb.locations) {
      if (loc.address && lowerResponse.includes(loc.address.toLowerCase())) {
        return true;
      }
      if (loc.neighborhood && lowerResponse.includes(loc.neighborhood.toLowerCase())) {
        return true;
      }
    }
  }
  
  // check if response mentions signature dishes
  if (kb.menu && kb.menu.signature_dishes && Array.isArray(kb.menu.signature_dishes)) {
    for (const dish of kb.menu.signature_dishes) {
      if (lowerResponse.includes(dish.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

const router = express.Router();

// load knowledge base (structured json)
const kb = JSON.parse(fs.readFileSync('./kb/knowledge.json', 'utf-8'));

// load system prompt
const systemPrompt = fs.readFileSync('./ai/systemPrompt.txt', 'utf-8');

// model name for ollama cloud
const modelName = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// main chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message, history: requestHistory = [] } = req.body || {};

    if (!message || !message.trim()) {
      return res.json({
        source: 'error',
        answer: 'please enter a message.',
        history: requestHistory
      });
    }

    // initialize history from request (or empty array)
    let history = Array.isArray(requestHistory) ? [...requestHistory] : [];
    
    // extract lastContext from history (last menu item mentioned)
    let lastContext = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].source === 'kb' && history[i].kbItem) {
        // check for menu item paths in new structure: menu.categories.*
        if (history[i].kbItem.includes('menu.categories')) {
          // extract menu item name from answer or metadata
          if (history[i].metadata && history[i].metadata.item && history[i].metadata.item.name) {
            lastContext = history[i].metadata.item.name;
            break;
          }
          // fallback: try to extract from answer
          const answer = history[i].content || '';
          const nameMatch = answer.match(/^([^:]+):/);
          if (nameMatch) {
            lastContext = nameMatch[1].trim();
            break;
          }
        }
      }
    }

    const totalStart = Date.now();

    // step 1: normalize message
    let normalized = normalizeMessage(message);
    console.log(`[chat] user prompt: ${message}`);
    console.log(`[chat] normalized: ${normalized}`);
    console.log(`[chat] history from localStorage: ${history.length} messages`);
    if (history.length > 0) {
      console.log(`[chat] last context from history: ${lastContext || 'none'}`);
    }

    // step 2: context injection (fixing the "it/they" problem)
    // if we have a previous menu item in context and the user uses pronouns,
    // append the context to help the kb find the match.
    let searchMessage = normalized;
    if (lastContext) {
      const pronouns = ['it', 'they', 'them', 'that', 'this', 'these', 'those'];
      const hasPronoun = pronouns.some(p => new RegExp(`\\b${p}\\b`, 'i').test(normalized));
      
      if (hasPronoun) {
        // appending context helps getKbAnswer find the specific dish
        searchMessage = `${normalized} ${lastContext}`;
      }
    }

    // step 3: check if should skip kb lookup (personal/memory questions)
    const skipKb = shouldSkipKbLookup(normalized);
    
    // step 4: try kb lookup first (skip for personal/memory questions)
    let kbResult = null;
    if (!skipKb) {
      kbResult = getKbAnswer(searchMessage, kb);
    } else {
      console.log(`[chat] skipping kb lookup (personal/memory question)`);
    }
    
    // step 5: kb hit handling
    if (kbResult) {
      // add to history
      history.push({ role: 'user', content: normalized });
      history.push({ 
        role: 'assistant', 
        content: kbResult.answer,
        source: 'kb',
        kbItem: kbResult.kbItem,
        kbHit: true,
        metadata: kbResult.metadata || null
      });

      // keep history concise (last 10 messages)
      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[chat] kb hit: ${kbResult.kbItem} (score: ${kbResult.score?.toFixed(3) || 'N/A'})`);
      console.log(`[chat] response: ${kbResult.answer}`);
      console.log(`[chat] updated history (localStorage): ${history.length} messages`);

      return res.json({
        source: 'kb',
        answer: kbResult.answer,
        kbHit: true,
        kbItem: kbResult.kbItem,
        kbScore: kbResult.score,
        metadata: kbResult.metadata || null,
        history: history, // return updated history
        responseTime: Date.now() - totalStart
      });
    }

    // step 6: no kb hit - fallback to llm (for all questions)
    // removed strict guardrail - allow llm to handle restaurant questions too
    // add user message to history for llm context
    history.push({ role: 'user', content: normalized });
    
    // get history excluding the current message we just added (for llm context)
    const historyForLLM = history.slice(0, -1); 
    const safeHistory = historyForLLM.slice(-10);

    // check if there was a recent kb hit in history to inform llm
    const recentKbHit = safeHistory
      .slice()
      .reverse()
      .find(msg => msg.kbHit === true);

    console.log(`[chat] history from localStorage: ${history.length} messages`);
    console.log(`[chat] history for llm (excluding current): ${historyForLLM.length} messages`);
    console.log(`[chat] safe history (last 10 for llm): ${safeHistory.length} messages`);
    if (recentKbHit) {
      console.log(`[chat] recent kb hit detected in history: ${recentKbHit.kbItem}`);
    }
    if (safeHistory.length > 0) {
      console.log(`[chat] history being passed to llm:`, JSON.stringify(safeHistory, null, 2));
    }

    console.log(`[chat] calling llm with model: ${modelName}`);
    let llmResult;
    try {
      llmResult = await callLLM(normalized, safeHistory, systemPrompt, modelName, recentKbHit);
      console.log(`[chat] llm call successful`);
    } catch (llmError) {
      console.error(`[chat] llm call failed:`, llmError.message);
      console.error(`[chat] llm error stack:`, llmError.stack);
      throw llmError;
    }
    
    // detect if llm response mentions restaurant info (potential kb hit)
    const kbHitDetected = detectKbHitInResponse(llmResult.answer, kb);
    
    // add llm response to history
    history.push({ 
      role: 'assistant', 
      content: llmResult.answer,
      source: 'llm',
      kbHit: kbHitDetected ? true : false
    });

    // final history cleanup
    if (history.length > 10) {
      history = history.slice(-10);
    }

    console.log(`[chat] kb miss: using llm`);
    console.log(`[chat] kb hit detected in response: ${kbHitDetected}`);
    console.log(`[chat] response: ${llmResult.answer}`);
    console.log(`[chat] llm response time: ${llmResult.responseTime}ms`);
    console.log(`[chat] updated history (localStorage): ${history.length} messages`);

    return res.json({
      source: 'llm',
      answer: llmResult.answer,
      kbHit: kbHitDetected,
      history: history, // return updated history
      responseTime: Date.now() - totalStart,
      llmResponseTime: llmResult.responseTime
    });

  } catch (err) {
    console.error('[chat] ====== error in chat route ======');
    console.error('[chat] error message:', err.message);
    console.error('[chat] error stack:', err.stack);
    console.error('[chat] error name:', err.name);
    if (err.response) {
      console.error('[chat] error response:', err.response);
    }
    console.error('[chat] =================================');
    // return current history even on error to maintain state
    const { history: requestHistory = [] } = req.body || {};
    return res.json({
      source: 'error',
      answer: 'error processing request.',
      history: Array.isArray(requestHistory) ? requestHistory : [],
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

export default router;