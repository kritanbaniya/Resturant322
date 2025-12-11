/**
 * voice route - wrapper around chat functionality with text-to-speech
 * 
 * flow:
 * 1. user speaks → speech-to-text (handled in frontend)
 * 2. text sent to /voice endpoint with conversation history
 * 3. same processing as /chat: normalize → kb check → llm if needed
 * 4. response converted to speech via eleven labs
 * 5. returns text response + audio + updated history
 * 
 * important: history is now stored in localStorage on frontend
 * and sent with each request to maintain conversation context
 */

import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
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

// eleven labs api key
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const elevenLabsVoiceId = process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // default voice

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
      model_id: 'eleven_turbo_v2_5', // updated to newer model available on free tier
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

  // use arrayBuffer instead of deprecated buffer()
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

    console.log(`[voice] history from localStorage: ${history.length} messages`);
    if (history.length > 0) {
      console.log(`[voice] last context from history: ${lastContext || 'none'}`);
    }

    const totalStart = Date.now();

    // step 1: normalize message
    let normalized = normalizeMessage(message);
    console.log(`[voice] stt prompt: ${message}`);
    console.log(`[voice] normalized: ${normalized}`);

    // step 2: context injection
    let searchMessage = normalized;
    if (lastContext) {
      const pronouns = ['it', 'they', 'them', 'that', 'this', 'these', 'those'];
      const hasPronoun = pronouns.some(p => new RegExp(`\\b${p}\\b`, 'i').test(normalized));
      
      if (hasPronoun) {
        searchMessage = `${normalized} ${lastContext}`;
      }
    }

    // step 3: check if restaurant-related and try kb lookup
    const isRestaurant = isRestaurantQuestion(normalized);
    const kbResult = getKbAnswer(searchMessage, kb);
    
    let answer = '';
    let source = '';
    let llmResponseTime = null;
    
    // step 4: kb hit handling
    if (isRestaurant && kbResult) {
      answer = kbResult.answer;
      source = 'kb';

      // add to history
      history.push({ role: 'user', content: normalized });
      history.push({ 
        role: 'assistant', 
        content: answer,
        source: 'kb',
        kbItem: kbResult.kbItem
      });

      // keep history concise (last 10 messages)
      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[voice] kb hit: ${kbResult.kbItem}`);
      console.log(`[voice] response: ${answer}`);
      console.log(`[voice] updated history (localStorage): ${history.length} messages`);
    }
    // step 5: restaurant question but no kb hit
    else if (isRestaurant && !kbResult) {
      answer = "i'm not sure about that specific restaurant detail. please check the official menu or ask the staff directly.";
      source = 'kb-fallback';
      
      history.push({ role: 'user', content: normalized });
      history.push({ 
        role: 'assistant', 
        content: answer,
        source: 'kb-fallback'
      });

      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[voice] kb miss: no match found`);
      console.log(`[voice] response: ${answer}`);
      console.log(`[voice] updated history (localStorage): ${history.length} messages`);
    }
    // step 6: general/conversational question (llm)
    else {
      // add user message to history for llm context
      history.push({ role: 'user', content: normalized });
      
      // get history excluding the current message we just added (for llm context)
      const historyForLLM = history.slice(0, -1); 
      const safeHistory = historyForLLM.slice(-10);

      console.log(`[voice] history from localStorage: ${history.length} messages`);
      console.log(`[voice] history for llm (excluding current): ${historyForLLM.length} messages`);
      console.log(`[voice] safe history (last 10 for llm): ${safeHistory.length} messages`);
      if (safeHistory.length > 0) {
        console.log(`[voice] history being passed to llm:`, JSON.stringify(safeHistory, null, 2));
      }

      const llmResult = await callLLM(normalized, safeHistory, systemPrompt, modelName);
      
      answer = llmResult.answer;
      source = 'llm';
      llmResponseTime = llmResult.responseTime;
      
      // add llm response to history
      history.push({ 
        role: 'assistant', 
        content: answer,
        source: 'llm'
      });

      // final history cleanup
      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[voice] kb miss: using llm`);
      console.log(`[voice] response: ${answer}`);
      console.log(`[voice] llm response time: ${llmResponseTime}ms`);
      console.log(`[voice] updated history (localStorage): ${history.length} messages`);
    }

    // generate speech using eleven labs
    let audioBuffer = null;
    let ttsSuccess = false;
    try {
      audioBuffer = await generateSpeech(answer);
      ttsSuccess = true;
    } catch (speechError) {
      ttsSuccess = false;
    }
    
    console.log(`[voice] tts: ${ttsSuccess ? 'success' : 'failure'}`);

    // return response with text, audio, and updated history
    const response = {
      source: source,
      answer: answer,
      history: history, // return updated history
      responseTime: Date.now() - totalStart
    };

    // if audio was generated, send it as base64 or return it directly
    if (audioBuffer) {
      // send audio as base64 for frontend to decode
      response.audioBase64 = audioBuffer.toString('base64');
      response.audioMimeType = 'audio/mpeg';
    }

    return res.json(response);

  } catch (err) {
    console.error('[voice] error:', err);
    // return current history even on error to maintain state
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
