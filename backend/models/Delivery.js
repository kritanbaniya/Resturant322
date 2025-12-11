const mongoose = require('mongoose');

const deliveryBidSchema = new mongoose.Schema({
  deliveryPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  bid_amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending"
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'delivery_bids'
});

deliveryBidSchema.index({ order: 1 });
deliveryBidSchema.index({ deliveryPerson: 1 });
deliveryBidSchema.index({ status: 1 });

const deliverySchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  deliveryPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bidAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["Assigned", "Out_For_Delivery", "Delivered", "Delivery_Failed"],
    default: "Assigned"
  },
  note: {
    type: String,
    default: ""
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
  collection: 'deliveries'
});

deliverySchema.index({ order: 1 });
deliverySchema.index({ deliveryPerson: 1 });
deliverySchema.index({ status: 1 });

deliverySchema.methods.set_status = function(new_status, note) {
  this.status = new_status;
  this.updated_at = new Date();
  if (note) {
    this.note = note;
  }
  return this.save();
};

deliverySchema.methods.attach_note = function(text) {
  this.note = text;
  return this.save();
};

module.exports = {
  DeliveryBid: mongoose.model('DeliveryBid', deliveryBidSchema),
  Delivery: mongoose.model('Delivery', deliverySchema)
};
