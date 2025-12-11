const jwt = require('jsonwebtoken');
const config = require('../config');

// middleware to verify jwt token
const tokenRequired = (req, res, next) => {
  let token = null;
  
  // check for token in authorization header
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    try {
      token = authHeader.split(" ")[1];
    } catch (error) {
      return res.status(401).json({ error: "Invalid authorization header format" });
    }
  }
  
  if (!token) {
    return res.status(401).json({ error: "Token is missing" });
  }
  
  try {
    // decode token
    const payload = jwt.verify(token, config.JWT_SECRET_KEY);
    req.current_user = {
      id: payload.user_id,
      role: payload.role,
      isVIP: payload.isVIP === true
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token has expired" });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(401).json({ error: `Authentication failed: ${error.message}` });
  }
};

module.exports = { tokenRequired };
