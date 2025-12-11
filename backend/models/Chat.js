const mongoose = require('mongoose');

const chatQuestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  queryText: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'chat_questions'
});

chatQuestionSchema.index({ userId: 1 });
chatQuestionSchema.index({ timestamp: 1 });

const chatAnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatQuestion',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  queryText: String,
  answerText: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true,
    enum: ["knowledge_base", "ai_model"]
  },
  rating: {
    type: Number,
    default: null
  },
  flagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'chat_answers'
});

chatAnswerSchema.index({ questionId: 1 });
chatAnswerSchema.index({ userId: 1 });
chatAnswerSchema.index({ source: 1 });
chatAnswerSchema.index({ flagged: 1 });
chatAnswerSchema.index({ created_at: 1 });

chatAnswerSchema.methods.set_rating = function(rating) {
  this.rating = rating;
  if (rating === 0) {
    this.flagged = true;
  }
  return this.save();
};

chatAnswerSchema.methods.flag = function(reason) {
  this.flagged = true;
  this.flagReason = reason || "Flagged for review";
  return this.save();
};

module.exports = {
  ChatQuestion: mongoose.model('ChatQuestion', chatQuestionSchema),
  ChatAnswer: mongoose.model('ChatAnswer', chatAnswerSchema)
};
