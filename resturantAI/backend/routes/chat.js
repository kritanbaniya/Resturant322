import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';

const router = express.Router();

// load knowledge base from local json
const kb = JSON.parse(fs.readFileSync('./kb/knowledge.json', 'utf-8'));

// load system prompt
const systemPrompt = fs.readFileSync('./ai/systemPrompt.txt', 'utf-8');

// simple substring match in kb
function checkKnowledgeBase(question) {
  const lower = question.toLowerCase();

  for (const key in kb) {
    if (lower.includes(key)) {
      return kb[key];
    }
  }

  return null;
}

// list of banned words (for user filtering)
const bannedWords = [
  "fuck", "shit", "bitch", "asshole", "bastard",
  "nigger", "nigga", "chink", "spic", "fag", "faggot",
  "retard", "slut", "whore",
  "kill you", "fight me"
];

// check for profanity in user input
function containsBadWords(text) {
  const lower = text.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
}

// call local ollama server
async function callLLM(prompt) {
  const model = process.env.OLLAMA_MODEL || 'mistral';

  // combine system prompt + user prompt
  const fullPrompt = `${systemPrompt}\n\nuser: ${prompt}\nassistant:`;

  try {
    // start timer
    const start = Date.now();

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        stream: false,
        num_predict: 120
      })
    });

    const data = await response.json();

    // end timer
    const end = Date.now();
    console.log(`llm response time: ${end - start} ms`);
    console.log('ollama raw response:', data);

    if (!data || !data.response) {
      return 'sorry, i could not generate a response';
    }

    return data.response.trim();

  } catch (err) {
    console.log('ollama error:', err);
    return 'sorry, the ai service is currently unavailable';
  }
}

// main chat endpoint
router.post('/', async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.json({
      source: 'error',
      answer: 'please enter a message'
    });
  }

  // start total timer
  const totalStart = Date.now();

  // block offensive messages directly
  if (containsBadWords(message)) {
    console.log('blocked offensive input');
    const totalEndBad = Date.now();
    console.log(`total request time (blocked): ${totalEndBad - totalStart} ms`);

    return res.json({
      source: 'filter',
      answer: "let’s keep things respectful. how can i help you with anything related to the restaurant?"
    });
  }

  // kb lookup timer
  const kbStart = Date.now();
  const kbAnswer = checkKnowledgeBase(message);
  const kbEnd = Date.now();

  console.log(`kb lookup time: ${kbEnd - kbStart} ms`);

  if (kbAnswer) {
    const totalEndKB = Date.now();
    console.log(`total request time (kb): ${totalEndKB - totalStart} ms`);

    return res.json({
      source: 'kb',
      answer: kbAnswer
    });
  }

  // fallback to llm
  const llmAnswer = await callLLM(message);

  const totalEndLLM = Date.now();
  console.log(`total request time (llm): ${totalEndLLM - totalStart} ms`);

  return res.json({
    source: 'llm',
    answer: llmAnswer
  });
});

export default router;
