const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// connect to mongodb
mongoose.connect(config.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// routes
app.get("/", (req, res) => {
  return res.status(200).json({ message: "API is running." });
});

app.use('/api/auth', require('./routes/auth_routes'));
app.use('/api/users', require('./routes/user_routes'));
app.use('/api/orders', require('./routes/order_routes'));
app.use('/api/chefs', require('./routes/chef_routes'));
app.use('/api/delivery', require('./routes/delivery_routes'));
app.use('/api/manager', require('./routes/manager_routes'));
app.use('/api/menu', require('./routes/menu_routes'));
app.use('/api/chat', require('./routes/chat_routes'));
app.use('/api/complaints', require('./routes/complaint_route'));
app.use('/api/visitor', require('./routes/visitor_routes'));

// error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: "Validation Error",
      details: err.message
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(404).json({
      error: "Resource not found"
    });
  }
  
  return res.status(500).json({
    error: "An unexpected error occurred",
    details: err.message
  });
});

// 404 handler
app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found"
  });
});

// start server
const PORT = config.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
