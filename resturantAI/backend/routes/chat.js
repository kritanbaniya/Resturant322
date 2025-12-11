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
import { isRestaurantQuestion } from './utils/questionClassifier.js';
import { getKbAnswer } from './utils/knowledgeBase.js';
import { callLLM } from './utils/llmService.js';

const router = express.Router();

// load knowledge base (structured json)
const kb = JSON.parse(fs.readFileSync('./kb/knowledge.json', 'utf-8'));

// load system prompt
const systemPrompt = fs.readFileSync('./ai/systemPrompt.txt', 'utf-8');

// model name for ollama
const modelName = process.env.OLLAMA_MODEL || 'mistral:instruct';

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
      if (history[i].source === 'kb' && history[i].kbItem && history[i].kbItem.startsWith('menu_items.')) {
        const parts = history[i].kbItem.split('.');
        if (parts.length >= 2) {
          lastContext = parts[1];
          break;
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

    // step 3: check if restaurant-related and try kb lookup
    const isRestaurant = isRestaurantQuestion(normalized);
    const kbResult = getKbAnswer(searchMessage, kb);
    
    // step 4: kb hit handling
    if (isRestaurant && kbResult) {
      // add to history
      history.push({ role: 'user', content: normalized });
      history.push({ 
        role: 'assistant', 
        content: kbResult.answer,
        source: 'kb',
        kbItem: kbResult.kbItem
      });

      // keep history concise (last 10 messages)
      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[chat] kb hit: ${kbResult.kbItem}`);
      console.log(`[chat] response: ${kbResult.answer}`);
      console.log(`[chat] updated history (localStorage): ${history.length} messages`);

      return res.json({
        source: 'kb',
        answer: kbResult.answer,
        kbHit: true,
        kbItem: kbResult.kbItem,
        history: history, // return updated history
        responseTime: Date.now() - totalStart
      });
    }

    // step 5: restaurant question but no kb hit (guardrail)
    if (isRestaurant && !kbResult) {
      const fallbackAnswer = "i'm not sure about that specific restaurant detail. please check the official menu or ask the staff directly.";
      
      history.push({ role: 'user', content: normalized });
      history.push({ 
        role: 'assistant', 
        content: fallbackAnswer,
        source: 'kb-fallback'
      });

      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[chat] kb miss: no match found`);
      console.log(`[chat] response: ${fallbackAnswer}`);
      console.log(`[chat] updated history (localStorage): ${history.length} messages`);

      return res.json({
        source: 'kb-fallback',
        answer: fallbackAnswer,
        kbHit: false,
        history: history, // return updated history
        responseTime: Date.now() - totalStart
      });
    }

    // step 6: general/conversational question (llm)
    // add user message to history for llm context
    history.push({ role: 'user', content: normalized });
    
    // get history excluding the current message we just added (for llm context)
    const historyForLLM = history.slice(0, -1); 
    const safeHistory = historyForLLM.slice(-10);

    console.log(`[chat] history from localStorage: ${history.length} messages`);
    console.log(`[chat] history for llm (excluding current): ${historyForLLM.length} messages`);
    console.log(`[chat] safe history (last 10 for llm): ${safeHistory.length} messages`);
    if (safeHistory.length > 0) {
      console.log(`[chat] history being passed to llm:`, JSON.stringify(safeHistory, null, 2));
    }

    const llmResult = await callLLM(normalized, safeHistory, systemPrompt, modelName);
    
    // add llm response to history
    history.push({ 
      role: 'assistant', 
      content: llmResult.answer,
      source: 'llm'
    });

    // final history cleanup
    if (history.length > 10) {
      history = history.slice(-10);
    }

    console.log(`[chat] kb miss: using llm`);
    console.log(`[chat] response: ${llmResult.answer}`);
    console.log(`[chat] llm response time: ${llmResult.responseTime}ms`);
    console.log(`[chat] updated history (localStorage): ${history.length} messages`);

    return res.json({
      source: 'llm',
      answer: llmResult.answer,
      kbHit: false,
      history: history, // return updated history
      responseTime: Date.now() - totalStart,
      llmResponseTime: llmResult.responseTime
    });

  } catch (err) {
    console.error('[chat] error:', err);
    // return current history even on error to maintain state
    const { history: requestHistory = [] } = req.body || {};
    return res.json({
      source: 'error',
      answer: 'error processing request.',
      history: Array.isArray(requestHistory) ? requestHistory : []
    });
  }
});

export default router;