/**
 * voice route - wrapper around chat functionality with text-to-speech
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
 * 5. (voice mode) → convert to audio with elevenlabs
 * 6. return text response + audio + updated history
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { searchKb, formatKbAnswer, initializeKb } = require('../utils/vectorSearch');
const { callLLM } = require('../utils/llmService');
const { textToSpeech } = require('../utils/ttsService');

const router = express.Router();

// load knowledge base
const kbPath = path.join(__dirname, '../kb/knowledge.json');
const kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));

// load system prompt
const promptPath = path.join(__dirname, '../ai/systemPrompt.txt');
const systemPrompt = fs.readFileSync(promptPath, 'utf-8');

// model name for ollama cloud
const modelName = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// initialize kb embeddings on startup
let kbInitialized = false;
initializeKb(kb).then(() => {
  kbInitialized = true;
  console.log('[voice] kb initialized and ready');
}).catch(err => {
  console.error('[voice] kb initialization failed:', err.message);
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

// main voice endpoint
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
    console.log(`[voice] stt prompt: ${message}`);
    console.log(`[voice] normalized: ${normalized}`);

    // step 2: vector search against kb (embeddings) → top k relevant kb facts
    // only include results above similarity threshold (default: 0.3)
    let kbFacts = [];
    let kbHitItems = [];
    let kbHit = false;
    
    if (kbInitialized) {
      try {
        const minScore = 0.3; // minimum similarity score to consider a hit
        const kbResults = await searchKb(normalized, 3, minScore);
        console.log(`[voice] vector search completed, found ${kbResults.length} results above threshold (${minScore})`);
        
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
          console.log(`[voice] ====== KB HIT DETECTED ======`);
          console.log(`[voice] user query: "${normalized}"`);
          console.log(`[voice] kb items matched: ${kbHitItems.length} (threshold: ${minScore})`);
          kbHitItems.forEach((item, idx) => {
            console.log(`[voice]   ${idx + 1}. ${item.type}.${item.field} (${item.path}) - score: ${item.score}`);
          });
          console.log(`[voice] ============================`);
        } else {
          console.log(`[voice] no kb hits found for query: "${normalized}" (all results below threshold ${minScore})`);
        }
      } catch (searchError) {
        console.error('[voice] vector search error:', searchError.message);
        // continue without kb facts
      }
    } else {
      console.warn('[voice] kb not initialized yet, skipping search');
    }

    // step 3: add user message to history
    history.push({ role: 'user', content: normalized });
    
    // get recent history for llm (last 10 messages, excluding current)
    const historyForLLM = history.slice(0, -1).slice(-10);

    // step 4: build llm prompt (system prompt + last 10 messages + kb facts + user message)
    // call llm with kb facts
    console.log(`[voice] calling llm with ${kbFacts.length} kb facts`);
    let llmResult;
    try {
      llmResult = await callLLM(normalized, historyForLLM, systemPrompt, modelName, kbFacts);
      console.log(`[voice] llm call successful`);
    } catch (llmError) {
      console.error(`[voice] llm call failed:`, llmError.message);
      throw llmError;
    }
    
    const answer = llmResult.answer;
    
    // step 5: llm generates final response
    // add llm response to history
    history.push({ 
      role: 'assistant', 
      content: answer,
      source: 'llm',
      kbHit: kbHit,
      kbItems: kbHitItems
    });

    // keep history concise (last 10 messages)
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // log final response with kb hit status
    console.log(`[voice] ====== RESPONSE SUMMARY ======`);
    console.log(`[voice] kb hit: ${kbHit ? 'YES' : 'NO'}`);
    if (kbHit) {
      console.log(`[voice] kb items: ${kbHitItems.map(item => item.path).join(', ')}`);
    }
    console.log(`[voice] response: ${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}`);
    console.log(`[voice] llm response time: ${llmResult.responseTime}ms`);
    console.log(`[voice] total response time: ${Date.now() - totalStart}ms`);
    console.log(`[voice] =============================`);

    // step 6: (voice mode) → convert to audio with elevenlabs
    // generate speech using eleven labs
    let audioData = null;
    let ttsSuccess = false;
    try {
      console.log('[voice] generating audio for voice response...');
      audioData = await textToSpeech(answer);
      ttsSuccess = !!audioData;
    } catch (speechError) {
      console.error('[voice] tts error:', speechError.message);
      ttsSuccess = false;
    }
    
    console.log(`[voice] tts: ${ttsSuccess ? 'success' : 'failure'}`);

    // return response with text, audio, and updated history
    const response = {
      source: 'llm',
      answer: answer,
      kbHit: kbHit,
      kbItems: kbHitItems,
      history: history,
      responseTime: Date.now() - totalStart,
      llmResponseTime: llmResult.responseTime
    };

    // if audio was generated, send it as base64
    if (audioData) {
      response.audioBase64 = audioData.audioBase64;
      response.audioMimeType = audioData.mimeType;
    }

    return res.json(response);

  } catch (err) {
    console.error('[voice] ====== error in voice route ======');
    console.error('[voice] error message:', err.message);
    console.error('[voice] error stack:', err.stack);
    console.error('[voice] =================================');
    
    const { history: requestHistory = [] } = req.body || {};
    return res.json({
      source: 'error',
      answer: 'error processing voice request.',
      history: Array.isArray(requestHistory) ? requestHistory : []
    });
  }
});

module.exports = router;
