const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  dish: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dish',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],

  original_price: {
    type: Number,
    default: 0.0
  },
  discount_applied: {
    type: Number,
    default: 0.0
  },
  final_price: {
    type: Number,
    default: 0.0
  },

  status: {
    type: String,
    required: true,
    enum: [
      "PendingPayment",
      "Paid",
      "Rejected_Insufficient_Funds",
      "Queued_For_Preparation",
      "In_Preparation",
      "On_Hold",
      "Ready_For_Delivery",
      "Awaiting_Pickup",
      "Out_For_Delivery",
      "Completed",
      "Delivery_Failed"
    ],
    default: "PendingPayment"
  },
  notes: {
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
  collection: 'orders'
});

// indexes
orderSchema.index({ customer: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ created_at: 1 });

// methods
orderSchema.methods.calculate_total_price = async function() {
  let total = 0;
  for (const item of this.items) {
    total += item.price * item.quantity;
  }
  
  this.original_price = total;
  
  // populate customer to check vip status if not already populated
  if (!this.customer || typeof this.customer.isVIP === 'undefined') {
    await this.populate('customer');
  }
  
  if (this.customer.isVIP) {
    this.discount_applied = Math.round(total * 0.1 * 100) / 100; // 10% discount
  } else {
    this.discount_applied = 0.0;
  }

  this.final_price = total - this.discount_applied;
  return this.save();
};

orderSchema.methods.set_status = function(new_status) {
  this.status = new_status;
  this.updated_at = new Date();
  return this.save();
};

orderSchema.methods.add_note = function(text) {
  this.notes = text;
  return this.save();
};

orderSchema.methods.increment_dish_order_counts = async function() {
  const Dish = mongoose.model('Dish');
  for (const item of this.items) {
    await Dish.findByIdAndUpdate(item.dish, { $inc: { order_count: 1 } });
  }
};

module.exports = mongoose.model('Order', orderSchema);
