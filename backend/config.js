require('dotenv').config();

module.exports = {
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/ai_eats",
  JWT_SECRET_KEY: process.env.JWT_SECRET || "supersecretkey",
  DEBUG: process.env.DEBUG === "True" || process.env.DEBUG === "true",
  PORT: process.env.PORT || 5000
};
