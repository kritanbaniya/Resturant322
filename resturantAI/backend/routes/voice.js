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

    // step 3: check if should skip kb lookup (personal/memory questions)
    const skipKb = shouldSkipKbLookup(normalized);
    
    // step 4: try kb lookup first (skip for personal/memory questions)
    let kbResult = null;
    if (!skipKb) {
      kbResult = getKbAnswer(searchMessage, kb);
    } else {
      console.log(`[voice] skipping kb lookup (personal/memory question)`);
    }
    
    let answer = '';
    let source = '';
    let llmResponseTime = null;
    let kbHit = false;
    
    // step 5: kb hit handling
    if (kbResult) {
      answer = kbResult.answer;
      source = 'kb';
      kbHit = true;

      // add to history
      history.push({ role: 'user', content: normalized });
      history.push({ 
        role: 'assistant', 
        content: answer,
        source: 'kb',
        kbItem: kbResult.kbItem,
        kbHit: true,
        metadata: kbResult.metadata || null
      });

      // keep history concise (last 10 messages)
      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[voice] kb hit: ${kbResult.kbItem} (score: ${kbResult.score?.toFixed(3) || 'N/A'})`);
      console.log(`[voice] response: ${answer}`);
      console.log(`[voice] updated history (localStorage): ${history.length} messages`);
    }
    // step 6: no kb hit - fallback to llm (for all questions)
    else {
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

      console.log(`[voice] history from localStorage: ${history.length} messages`);
      console.log(`[voice] history for llm (excluding current): ${historyForLLM.length} messages`);
      console.log(`[voice] safe history (last 10 for llm): ${safeHistory.length} messages`);
      if (recentKbHit) {
        console.log(`[voice] recent kb hit detected in history: ${recentKbHit.kbItem}`);
      }
      if (safeHistory.length > 0) {
        console.log(`[voice] history being passed to llm:`, JSON.stringify(safeHistory, null, 2));
      }

      console.log(`[voice] calling llm with model: ${modelName}`);
      let llmResult;
      try {
        llmResult = await callLLM(normalized, safeHistory, systemPrompt, modelName, recentKbHit);
        console.log(`[voice] llm call successful`);
      } catch (llmError) {
        console.error(`[voice] llm call failed:`, llmError.message);
        console.error(`[voice] llm error stack:`, llmError.stack);
        throw llmError;
      }
      
      answer = llmResult.answer;
      source = 'llm';
      llmResponseTime = llmResult.responseTime;
      
      // detect if llm response mentions restaurant info (potential kb hit)
      kbHit = detectKbHitInResponse(answer, kb);
      
      // add llm response to history
      history.push({ 
        role: 'assistant', 
        content: answer,
        source: 'llm',
        kbHit: kbHit
      });

      // final history cleanup
      if (history.length > 10) {
        history = history.slice(-10);
      }

      console.log(`[voice] kb miss: using llm`);
      console.log(`[voice] kb hit detected in response: ${kbHit}`);
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
      kbHit: kbHit,
      history: history, // return updated history
      responseTime: Date.now() - totalStart
    };
    
    if (llmResponseTime !== null) {
      response.llmResponseTime = llmResponseTime;
    }

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
