const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    required: true
  },
  image_url: String,
  price: {
    type: Number,
    required: true
  },
  is_available: {
    type: Boolean,
    default: true
  },
  order_count: {
    type: Number,
    default: 0
  },
  average_rating: {
    type: Number,
    default: 0.0
  },
  rating_count: {
    type: Number,
    default: 0
  },
  tags: [String]
}, {
  collection: 'dishes'
});

// indexes
dishSchema.index({ name: 1 });
dishSchema.index({ category: 1 });
dishSchema.index({ order_count: 1 });
dishSchema.index({ average_rating: 1 });

// methods
dishSchema.methods.add_rating = function(rating) {
  const total_rating = this.average_rating * this.rating_count;
  this.rating_count += 1;
  this.average_rating = (total_rating + rating) / this.rating_count;
  return this.save();
};

dishSchema.methods.increment_order_count = function() {
  this.order_count += 1;
  return this.save();
};

module.exports = mongoose.model('Dish', dishSchema);
