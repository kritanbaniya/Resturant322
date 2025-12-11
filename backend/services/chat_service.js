const { ChatQuestion, ChatAnswer } = require('../models/Chat');
const KnowledgeBaseEntry = require('../models/KnowledgeBase');
const { callLLM } = require('../resturantAI/utils/llmService');
const { searchKb, formatKbAnswer } = require('../resturantAI/utils/vectorSearch');
const fs = require('fs');
const path = require('path');

// track ai service availability
let aiServiceAvailable = true;

// load knowledge base and system prompt for ai chat
let kb = null;
let systemPrompt = null;
let kbInitialized = false;

// initialize kb on startup
(async () => {
  try {
    const kbPath = path.join(__dirname, '../resturantAI/kb/knowledge.json');
    const promptPath = path.join(__dirname, '../resturantAI/ai/systemPrompt.txt');
    
    if (fs.existsSync(kbPath)) {
      kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    }
    if (fs.existsSync(promptPath)) {
      systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    }
    
    if (kb) {
      const { initializeKb } = require('../resturantAI/utils/vectorSearch');
      await initializeKb(kb);
      kbInitialized = true;
      console.log('[chat_service] kb initialized and ready');
    }
  } catch (err) {
    console.error('[chat_service] kb initialization failed:', err.message);
  }
})();

// generate a response using a generative ai model
async function generativeAiResponse(prompt, history = []) {
  if (!aiServiceAvailable) {
    return null;
  }
  
  if (!systemPrompt) {
    return "AI service is not properly configured.";
  }
  
  try {
    // search kb for relevant facts
    let kbFacts = [];
    if (kbInitialized && kb) {
      try {
        const kbResults = await searchKb(prompt.toLowerCase().trim(), 3, 0.3);
        if (kbResults.length > 0) {
          kbFacts = kbResults.map(result => formatKbAnswer(result, kb));
        }
      } catch (searchError) {
        console.error('[chat_service] vector search error:', searchError.message);
      }
    }
    
    // call llm
    const modelName = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const llmResult = await callLLM(prompt, history, systemPrompt, modelName, kbFacts);
    return llmResult.answer;
  } catch (error) {
    console.error('[chat_service] llm error:', error.message);
    return null;
  }
}

// search the knowledge base for a relevant answer
async function searchKnowledgeBase(query) {
  const queryLower = query.toLowerCase();
  const entries = await KnowledgeBaseEntry.find({});
  
  for (const entry of entries) {
    if (entry.keywords && entry.keywords.length > 0) {
      if (entry.keywords.some(k => queryLower.includes(k.toLowerCase()))) {
        return entry.answerText;
      }
    }
    
    if (entry.questionText.toLowerCase().includes(queryLower)) {
      return entry.answerText;
    }
  }
  return null;
}

// handle user question and generate answer
async function askAi(userId, questionText) {
  if (!aiServiceAvailable) {
    return {
      error: "AI assistance temporarily unavailable.",
      message: "The AI chat service is currently offline. Please try again later."
    }, 503;
  }
  
  const chatQuestion = new ChatQuestion({
    userId: userId || null,
    queryText: questionText
  });
  
  await chatQuestion.save();
  
  // try kb first
  const kbAnswer = await searchKnowledgeBase(questionText);
  if (kbAnswer) {
    const chatAnswer = new ChatAnswer({
      questionId: chatQuestion._id,
      userId: userId || null,
      queryText: questionText,
      answerText: kbAnswer,
      source: "knowledge_base"
    });
    
    await chatAnswer.save();
    return {
      answer: kbAnswer,
      source: "knowledge_base",
      answer_id: chatAnswer._id.toString()
    }, 200;
  }
  
  // fall back to llm
  const aiResponse = await generativeAiResponse(questionText, []);
  if (!aiResponse) {
    return {
      error: "AI assistance temporarily unavailable.",
      message: "The LLM service is currently offline. Please try again later."
    }, 503;
  }
  
  const chatAnswer = new ChatAnswer({
    questionId: chatQuestion._id,
    userId: userId || null,
    queryText: questionText,
    answerText: aiResponse,
    source: "ai_model"
  });
  
  await chatAnswer.save();
  
  return {
    answer: aiResponse,
    source: "ai_model",
    answer_id: chatAnswer._id.toString()
  }, 200;
}

// rate a chat answer
async function rateAnswer(answerId, rating) {
  const answer = await ChatAnswer.findById(answerId);
  if (!answer) {
    return { error: "Chat answer not found." }, 404;
  }
  
  if (rating < 0 || rating > 5) {
    return { error: "Rating must be between 0 and 5." }, 400;
  }
  
  await answer.set_rating(rating);
  return { message: "Rating submitted successfully." }, 200;
}

// flag a chat answer for review
async function flagAnswer(answerId, reason = null) {
  const answer = await ChatAnswer.findById(answerId);
  if (!answer) {
    return { error: "Chat answer not found." }, 404;
  }
  
  await answer.flag(reason);
  return {
    message: "Answer flagged for review.",
    note: "Thank you for your feedback. Our management team will review this response."
  }, 200;
}

// retrieve chat history for a user
async function getChatHistory(userId) {
  if (!userId) {
    return null, 200;
  }
  
  const questions = await ChatQuestion.find({ userId }).sort({ timestamp: -1 });
  
  const history = [];
  for (const q of questions) {
    const answer = await ChatAnswer.findOne({ questionId: q._id });
    
    history.push({
      question: q.queryText,
      timestamp: q.timestamp,
      answer: answer ? answer.answerText : null,
      source: answer ? answer.source : null,
      rating: answer ? answer.rating : null,
      flagged: answer ? answer.flagged : null
    });
  }
  
  return history, 200;
}

// set ai service availability
function setAiAvailability(available) {
  aiServiceAvailable = available;
  return {
    message: `AI service ${available ? 'enabled' : 'disabled'}`,
    available: aiServiceAvailable
  };
}

// get ai service status
function getAiStatus() {
  return {
    available: aiServiceAvailable,
    status: aiServiceAvailable ? "online" : "offline"
  };
}

module.exports = {
  askAi,
  rateAnswer,
  flagAnswer,
  getChatHistory,
  setAiAvailability,
  getAiStatus
};
