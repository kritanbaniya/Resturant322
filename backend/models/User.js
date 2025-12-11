const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // personal info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: String,
  address: String,

  // role
  role: {
    type: String,
    required: true,
    enum: ["Customer", "VIP", "Chef", "DeliveryPerson", "Manager", "Demoted_Chef", "Demoted_DeliveryPerson"],
    default: "Customer"
  },

  // status
  status: {
    type: String,
    required: true,
    enum: ["Active", "PendingApproval", "Rejected", "Blacklisted", "Deregistered", "Terminated"],
    default: "PendingApproval"
  },

  // financial
  balance: {
    type: Number,
    default: 0.0
  },
  totalSpent: {
    type: Number,
    default: 0.0
  },
  orderCount: {
    type: Number,
    default: 0
  },
  isVIP: {
    type: Boolean,
    default: false
  },

  warningCount: {
    type: Number,
    default: 0
  },
  netComplaints: {
    type: Number,
    default: 0
  },
  demotionsCount: {
    type: Number,
    default: 0
  },
  
  // manager-related fields
  rejectionReason: String,
  terminationReason: String,

  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'users'
});

// indexes
userSchema.index({ email: 1 });

// methods
userSchema.methods.increment_warning = function() {
  this.warningCount += 1;
  return this.save();
};

userSchema.methods.add_spent = function(amount) {
  this.totalSpent += amount;
  this.orderCount += 1;
  return this.save();
};

userSchema.methods.upgrade_to_vip = function() {
  if (!this.isVIP && this.warningCount === 0) {
    if (this.totalSpent > 100 || this.orderCount >= 3) {
      this.isVIP = true;
      this.role = "VIP";
      return this.save().then(() => true);
    }
  }
  return Promise.resolve(false);
};

module.exports = mongoose.model('User', userSchema);
