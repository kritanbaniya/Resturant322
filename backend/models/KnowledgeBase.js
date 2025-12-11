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

knowledgeBaseSchema.methods.update_answer = function(new_answer) {
  this.answerText = new_answer;
  this.updated_at = new Date();
  return this.save();
};

module.exports = mongoose.model('KnowledgeBaseEntry', knowledgeBaseSchema);
