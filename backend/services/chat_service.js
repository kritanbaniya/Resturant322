const { ChatQuestion, ChatAnswer } = require('../models/Chat');
const KnowledgeBaseEntry = require('../models/KnowledgeBase');

// track ai service availability
let aiServiceAvailable = true;

// generate a response using a generative ai model (placeholder function)
function generativeAiResponse(prompt) {
  if (!aiServiceAvailable) {
    return null;
  }
  return "This is a generated response to your prompt.";
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
  const aiResponse = generativeAiResponse(questionText);
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
