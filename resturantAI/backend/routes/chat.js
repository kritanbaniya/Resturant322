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
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.json({
        source: 'error',
        answer: 'please enter a message.'
      });
    }

    // initialize session variables if needed
    if (!req.session.history) req.session.history = [];
    if (!req.session.lastContext) req.session.lastContext = null;

    const totalStart = Date.now();

    // step 1: normalize message
    let normalized = normalizeMessage(message);
    console.log(`original: ${message}`);
    console.log(`normalized: ${normalized}`);

    // step 2: context injection (fixing the "it/they" problem)
    // if we have a previous menu item in context and the user uses pronouns,
    // append the context to help the kb find the match.
    let searchMessage = normalized;
    if (req.session.lastContext) {
      const pronouns = ['it', 'they', 'them', 'that', 'this', 'these', 'those'];
      const hasPronoun = pronouns.some(p => new RegExp(`\\b${p}\\b`, 'i').test(normalized));
      
      if (hasPronoun) {
        console.log(`[Context] Detected pronoun with context: ${req.session.lastContext}`);
        // Appending context helps getKbAnswer find the specific dish
        searchMessage = `${normalized} ${req.session.lastContext}`;
      }
    }

    // step 3: check if restaurant-related and try kb lookup
    const isRestaurant = isRestaurantQuestion(normalized);
    
    // we use searchMessage (with context) for the lookup, but keep normalized for history
    const kbStart = Date.now();
    const kbResult = getKbAnswer(searchMessage, kb);
    const kbEnd = Date.now();
    
    // step 4: kb hit handling
    if (isRestaurant && kbResult) {
      console.log('restaurant question with kb hit.');
      console.log('kb answer:', kbResult.answer);

      // context update:
      // if the answer came from a specific menu item, update the session context.
      // example kbItem: "menu_items.momos.base_price" -> context: "momos"
      if (kbResult.kbItem && kbResult.kbItem.startsWith('menu_items.')) {
        const parts = kbResult.kbItem.split('.');
        if (parts.length >= 2) {
          req.session.lastContext = parts[1]; // Store key (e.g., "momos")
          console.log(`[Context] Updated session context to: ${parts[1]}`);
        }
      }

      // add to history
      req.session.history.push({ role: 'user', content: normalized });
      req.session.history.push({ 
        role: 'assistant', 
        content: kbResult.answer,
        source: 'kb'
      });

      // keep history concise (last 10 messages)
      if (req.session.history.length > 10) {
        req.session.history = req.session.history.slice(-10);
      }

      return res.json({
        source: 'kb',
        answer: kbResult.answer,
        kbHit: true,
        kbItem: kbResult.kbItem,
        responseTime: Date.now() - totalStart
      });
    }

    // step 5: restaurant question but no kb hit (guardrail)
    if (isRestaurant && !kbResult) {
      console.log('restaurant question with no kb match, using fallback.');
      
      const fallbackAnswer = "i'm not sure about that specific restaurant detail. please check the official menu or ask the staff directly.";
      
      req.session.history.push({ role: 'user', content: normalized });
      req.session.history.push({ 
        role: 'assistant', 
        content: fallbackAnswer,
        source: 'kb-fallback'
      });

      if (req.session.history.length > 10) {
        req.session.history = req.session.history.slice(-10);
      }

      return res.json({
        source: 'kb-fallback',
        answer: fallbackAnswer,
        kbHit: false,
        responseTime: Date.now() - totalStart
      });
    }

    // step 6: general/conversational question (llm)
    // add user message to history temporarily so we can track it
    req.session.history.push({ role: 'user', content: normalized });
    
    // prepare history for llm:
    // we pass the history excluding the current message we just pushed,
    // because llmService.js manually appends the current prompt to the end.
    // prepare history for llm (exclude current message)
    const historyForLLM = req.session.history.slice(0, -1); 
    
    // ensure we don't send too much history to llm (keep last 10 of the previous convo)
    const safeHistory = historyForLLM.slice(-10);

    const llmResult = await callLLM(normalized, safeHistory, systemPrompt, modelName);
    
    // add llm response to history
    req.session.history.push({ 
      role: 'assistant', 
      content: llmResult.answer,
      source: 'llm'
    });

    // final history cleanup
    if (req.session.history.length > 10) {
      req.session.history = req.session.history.slice(-10);
    }

    return res.json({
      source: 'llm',
      answer: llmResult.answer,
      kbHit: false,
      responseTime: Date.now() - totalStart,
      llmResponseTime: llmResult.responseTime
    });

  } catch (err) {
    console.error('chat error:', err);
    return res.json({
      source: 'error',
      answer: 'error processing request.'
    });
  }
});

export default router;