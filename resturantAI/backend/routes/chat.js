/**
 * chat route - simplified text-based chat interface
 * 
 * flow:
 * 1. user message
 * 2. vector search against kb (embeddings) → top k relevant kb facts
 * 3. build llm prompt:
 *    - system prompt
 *    - last 10 messages
 *    - kb facts
 *    - user message
 * 4. llm generates final response
 * 5. return response with updated history
 */

import express from 'express';
import fs from 'fs';
import { searchKb, formatKbAnswer, initializeKb } from './utils/vectorSearch.js';
import { callLLM } from './utils/llmService.js';

const router = express.Router();

// load knowledge base
const kb = JSON.parse(fs.readFileSync('./kb/knowledge.json', 'utf-8'));

// load system prompt
const systemPrompt = fs.readFileSync('./ai/systemPrompt.txt', 'utf-8');

// model name for ollama cloud
const modelName = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// initialize kb embeddings on startup
let kbInitialized = false;
initializeKb(kb).then(() => {
  kbInitialized = true;
  console.log('[chat] kb initialized and ready');
}).catch(err => {
  console.error('[chat] kb initialization failed:', err.message);
});

/**
 * normalize message - simple trim and lowercase
 * @param {string} message - user message
 * @returns {string} - normalized message
 */
function normalizeMessage(message) {
  if (!message) return '';
  return message.trim().toLowerCase();
}

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

    // initialize history from request
    let history = Array.isArray(requestHistory) ? [...requestHistory] : [];
    
    const totalStart = Date.now();

    // step 1: normalize message (trim + lowercase)
    const normalized = normalizeMessage(message);
    console.log(`[chat] user prompt: ${message}`);
    console.log(`[chat] normalized: ${normalized}`);

    // step 2: vector search against kb (embeddings) → top k relevant kb facts
    // only include results above similarity threshold (default: 0.3)
    let kbFacts = [];
    let kbHitItems = [];
    let kbHit = false;
    
    if (kbInitialized) {
      try {
        const minScore = 0.3; // minimum similarity score to consider a hit
        const kbResults = await searchKb(normalized, 3, minScore);
        console.log(`[chat] vector search completed, found ${kbResults.length} results above threshold (${minScore})`);
        
        if (kbResults.length > 0) {
          kbHit = true;
          
          // track kb hit items
          kbHitItems = kbResults.map(result => ({
            path: result.metadata.path || 'unknown',
            type: result.metadata.type || 'unknown',
            field: result.metadata.field || 'unknown',
            score: result.score.toFixed(4)
          }));
          
          // format kb chunks into facts
          kbFacts = kbResults.map(result => formatKbAnswer(result, kb));
          
          // log kb hit details
          console.log(`[chat] ====== KB HIT DETECTED ======`);
          console.log(`[chat] user query: "${normalized}"`);
          console.log(`[chat] kb items matched: ${kbHitItems.length} (threshold: ${minScore})`);
          kbHitItems.forEach((item, idx) => {
            console.log(`[chat]   ${idx + 1}. ${item.type}.${item.field} (${item.path}) - score: ${item.score}`);
          });
          console.log(`[chat] ============================`);
        } else {
          console.log(`[chat] no kb hits found for query: "${normalized}" (all results below threshold ${minScore})`);
        }
      } catch (searchError) {
        console.error('[chat] vector search error:', searchError.message);
        // continue without kb facts
      }
    } else {
      console.warn('[chat] kb not initialized yet, skipping search');
    }

    // step 3: add user message to history
    history.push({ role: 'user', content: normalized });
    
    // get recent history for llm (last 10 messages, excluding current)
    const historyForLLM = history.slice(0, -1).slice(-10);

    // step 4: build llm prompt (system prompt + last 10 messages + kb facts + user message)
    // call llm with kb facts
    console.log(`[chat] calling llm with ${kbFacts.length} kb facts`);
    let llmResult;
    try {
      llmResult = await callLLM(normalized, historyForLLM, systemPrompt, modelName, kbFacts);
      console.log(`[chat] llm call successful`);
    } catch (llmError) {
      console.error(`[chat] llm call failed:`, llmError.message);
      throw llmError;
    }
    
    // step 5: llm generates final response
    // add llm response to history
    history.push({ 
      role: 'assistant', 
      content: llmResult.answer,
      source: 'llm',
      kbHit: kbHit,
      kbItems: kbHitItems
    });

    // keep history concise (last 10 messages)
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // log final response with kb hit status
    console.log(`[chat] ====== RESPONSE SUMMARY ======`);
    console.log(`[chat] kb hit: ${kbHit ? 'YES' : 'NO'}`);
    if (kbHit) {
      console.log(`[chat] kb items: ${kbHitItems.map(item => item.path).join(', ')}`);
    }
    console.log(`[chat] response: ${llmResult.answer.substring(0, 100)}${llmResult.answer.length > 100 ? '...' : ''}`);
    console.log(`[chat] llm response time: ${llmResult.responseTime}ms`);
    console.log(`[chat] total response time: ${Date.now() - totalStart}ms`);
    console.log(`[chat] =============================`);

    return res.json({
      source: 'llm',
      answer: llmResult.answer,
      kbHit: kbHit,
      kbItems: kbHitItems,
      history: history,
      responseTime: Date.now() - totalStart,
      llmResponseTime: llmResult.responseTime
    });

  } catch (err) {
    console.error('[chat] ====== error in chat route ======');
    console.error('[chat] error message:', err.message);
    console.error('[chat] error stack:', err.stack);
    console.error('[chat] =================================');
    
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
