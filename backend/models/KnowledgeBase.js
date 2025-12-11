const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true
  },
  answerText: {
    type: String,
    required: true
  },
  keywords: [String],
  embedding: {
    type: [Number],
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  flagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,
  reviewCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'knowledge_base'
});

knowledgeBaseSchema.index({ questionText: 1 });
knowledgeBaseSchema.index({ keywords: 1 });
knowledgeBaseSchema.index({ flagged: 1 });

knowledgeBaseSchema.methods.update_answer = function(new_answer) {
  this.answerText = new_answer;
  this.updated_at = new Date();
  return this.save();
};

knowledgeBaseSchema.methods.add_review = function(rating) {
  this.reviewCount += 1;
  if (this.averageRating === null) {
    this.averageRating = rating;
  } else {
    this.averageRating = ((this.averageRating * (this.reviewCount - 1)) + rating) / this.reviewCount;
  }
  if (rating === 1) {
    this.flagged = true;
    this.flagReason = 'low rating (1 star)';
  }
  this.updated_at = new Date();
  return this.save();
};

knowledgeBaseSchema.methods.flag_for_review = function(reason) {
  this.flagged = true;
  this.flagReason = reason || 'flagged for manager review';
  this.updated_at = new Date();
  return this.save();
};

module.exports = mongoose.model('KnowledgeBaseEntry', knowledgeBaseSchema);
