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

import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import { searchKb, formatKbAnswer } from './utils/vectorSearch.js';
import { callLLM } from './utils/llmService.js';

const router = express.Router();

// load knowledge base
const kb = JSON.parse(fs.readFileSync('./kb/knowledge.json', 'utf-8'));

// load system prompt
const systemPrompt = fs.readFileSync('./ai/systemPrompt.txt', 'utf-8');

// model name for ollama cloud
const modelName = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// eleven labs api key
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const elevenLabsVoiceId = process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

/**
 * normalize message - simple trim and lowercase
 * @param {string} message - user message
 * @returns {string} - normalized message
 */
function normalizeMessage(message) {
  if (!message) return '';
  return message.trim().toLowerCase();
}

/**
 * generate speech using eleven labs api
 * @param {string} text - text to convert to speech
 * @returns {promise<buffer>} - audio buffer
 */
async function generateSpeech(text) {
  if (!elevenLabsApiKey) {
    throw new Error('eleven labs api key not configured');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eleven labs api error: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// main voice endpoint
router.post('/', async (req, res) => {
  try {
    const { message, history: requestHistory = [] } = req.body || {};

    if (!message || !message.trim()) {
      return res.json({
        source: 'error',
        answer: 'please enter a message.',
        audioUrl: null,
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
    let audioBuffer = null;
    let ttsSuccess = false;
    try {
      audioBuffer = await generateSpeech(answer);
      ttsSuccess = true;
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
    if (audioBuffer) {
      response.audioBase64 = audioBuffer.toString('base64');
      response.audioMimeType = 'audio/mpeg';
    }

    return res.json(response);

  } catch (err) {
    console.error('[voice] error:', err);
    const { history: requestHistory = [] } = req.body || {};
    return res.json({
      source: 'error',
      answer: 'error processing voice request.',
      audioUrl: null,
      history: Array.isArray(requestHistory) ? requestHistory : []
    });
  }
});

export default router;
