const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  targetId: String,
  entityType: {
    type: String,
    required: true
  },
  isComplaint: {
    type: Boolean,
    required: true
  },
  message: String,
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  weight: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ["PendingReview", "Valid", "Invalid", "Escalated"],
    default: "PendingReview"
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  escalationNote: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  resolved_at: Date
}, {
  collection: 'complaints'
});

complaintSchema.index({ toUser: 1 });
complaintSchema.index({ fromUser: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ isComplaint: 1 });

complaintSchema.methods.mark_valid = function() {
  this.status = "Valid";
  this.resolved_at = new Date();
  return this.save();
};

complaintSchema.methods.mark_invalid = function() {
  this.status = "Invalid";
  this.resolved_at = new Date();
  return this.save();
};

module.exports = mongoose.model('Complaint', complaintSchema);
