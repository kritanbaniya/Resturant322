const { ChatQuestion, ChatAnswer } = require('../models/Chat');
const KnowledgeBaseEntry = require('../models/KnowledgeBase');
const { callLLM } = require('../resturantAI/utils/llmService');
const { searchKb, formatKbAnswer, initializeKb } = require('../resturantAI/utils/vectorSearch');
const fs = require('fs');
const path = require('path');

// track ai service availability
let aiServiceAvailable = true;

// load system prompt for ai chat
let systemPrompt = null;
let kbInitialized = false;

// initialize kb from mongodb on startup
(async () => {
  try {
    const promptPath = path.join(__dirname, '../resturantAI/ai/systemPrompt.txt');
    
    if (fs.existsSync(promptPath)) {
      systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    }
    
    // initialize kb from mongodb
    await initializeKb();
    kbInitialized = true;
    console.log('[chat_service] kb initialized from mongodb and ready');
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
    if (kbInitialized) {
      try {
        const kbResults = await searchKb(prompt.toLowerCase().trim(), 3, 0.3);
        if (kbResults.length > 0) {
          kbFacts = kbResults.map(result => formatKbAnswer(result));
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
  
  // try vector search kb first
  let kbResult = null;
  if (kbInitialized) {
    try {
      const kbResults = await searchKb(questionText.toLowerCase().trim(), 1, 0.3);
      console.log(`[chat_service] prompt: "${questionText}"`);
      if (kbResults.length > 0) {
        console.log(`[chat_service] kb search results: ${kbResults.length} matches found`);
        kbResults.forEach((result, idx) => {
          console.log(`[chat_service]   match ${idx + 1}: score=${result.score.toFixed(4)}, entryId=${result.kbEntryId}`);
        });
        if (kbResults[0].score > 0.3) {
          kbResult = kbResults[0];
          console.log(`[chat_service] using kb result with score ${kbResult.score.toFixed(4)}`);
        } else {
          console.log(`[chat_service] kb score ${kbResults[0].score.toFixed(4)} below threshold 0.3, falling back to llm`);
        }
      } else {
        console.log(`[chat_service] no kb matches found, falling back to llm`);
      }
    } catch (searchError) {
      console.error('[chat_service] vector search error:', searchError.message);
    }
  } else {
    console.log(`[chat_service] prompt: "${questionText}" - kb not initialized, using llm`);
  }
  
  // fallback to keyword search if vector search didn't find anything
  if (!kbResult) {
    const kbAnswer = await searchKnowledgeBase(questionText);
    if (kbAnswer) {
      console.log(`[chat_service] using keyword-based kb match`);
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
  } else {
    // use vector search result
    const answerText = formatKbAnswer(kbResult);
    const chatAnswer = new ChatAnswer({
      questionId: chatQuestion._id,
      userId: userId || null,
      queryText: questionText,
      answerText: answerText,
      source: "knowledge_base",
      kbEntryId: kbResult.kbEntryId,
      kbScore: kbResult.score
    });
    
    await chatAnswer.save();
    
    // if score > 0.3, offer review option
    const response = {
      answer: answerText,
      source: "knowledge_base",
      answer_id: chatAnswer._id.toString(),
      kbEntryId: kbResult.kbEntryId,
      kbScore: kbResult.score
    };
    
    if (kbResult.score > 0.3) {
      response.reviewable = true;
    }
    
    return response, 200;
  }
  
  // fall back to llm
  console.log(`[chat_service] generating llm response for prompt: "${questionText}"`);
  const aiResponse = await generativeAiResponse(questionText, []);
  if (!aiResponse) {
    return {
      error: "AI assistance temporarily unavailable.",
      message: "The LLM service is currently offline. Please try again later."
    }, 503;
  }
  console.log(`[chat_service] llm response generated`);
  
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
    return [{ error: "Chat answer not found." }, 404];
  }
  
  if (rating < 1 || rating > 5) {
    return [{ error: "Rating must be between 1 and 5." }, 400];
  }
  
  await answer.set_rating(rating);
  
  // if this is a kb-based answer and rating is 1, flag the kb entry
  if (answer.source === "knowledge_base" && answer.kbEntryId && rating === 1) {
    try {
      const kbEntry = await KnowledgeBaseEntry.findById(answer.kbEntryId);
      if (kbEntry) {
        await kbEntry.add_review(rating);
        console.log(`[chat_service] flagged kb entry ${answer.kbEntryId} due to 1-star rating`);
      }
    } catch (error) {
      console.error('[chat_service] failed to flag kb entry:', error.message);
    }
  }
  
  return [{ message: "Rating submitted successfully." }, 200];
}

// flag a chat answer for review
async function flagAnswer(answerId, reason = null) {
  const answer = await ChatAnswer.findById(answerId);
  if (!answer) {
    return [{ error: "Chat answer not found." }, 404];
  }
  
  await answer.flag(reason);
  return [{
    message: "Answer flagged for review.",
    note: "Thank you for your feedback. Our management team will review this response."
  }, 200];
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

// review a kb-based answer (specific endpoint for kb reviews)
async function reviewKbAnswer(answerId, rating) {
  const answer = await ChatAnswer.findById(answerId);
  if (!answer) {
    return [{ error: "Chat answer not found." }, 404];
  }
  
  if (answer.source !== "knowledge_base") {
    return [{ error: "This answer is not from the knowledge base and cannot be reviewed." }, 400];
  }
  
  if (!answer.kbEntryId) {
    return [{ error: "Knowledge base entry ID not found for this answer." }, 400];
  }
  
  if (rating < 1 || rating > 5) {
    return [{ error: "Rating must be between 1 and 5." }, 400];
  }
  
  // update chat answer rating
  await answer.set_rating(rating);
  
  // update kb entry with review
  try {
    const kbEntry = await KnowledgeBaseEntry.findById(answer.kbEntryId);
    if (!kbEntry) {
      return [{ error: "Knowledge base entry not found." }, 404];
    }
    
    await kbEntry.add_review(rating);
    
    // if rating is 1, it's already flagged by add_review
    if (rating === 1) {
      return [{
        message: "Rating submitted successfully. This knowledge base entry has been flagged for manager review.",
        flagged: true
      }, 200];
    }
    
    return [{ message: "Rating submitted successfully." }, 200];
  } catch (error) {
    console.error('[chat_service] failed to update kb entry:', error.message);
    return [{ error: "Failed to update knowledge base entry." }, 500];
  }
}

module.exports = {
  askAi,
  rateAnswer,
  reviewKbAnswer,
  flagAnswer,
  getChatHistory,
  setAiAvailability,
  getAiStatus
};
