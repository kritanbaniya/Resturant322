const express = require('express');
const router = express.Router();
const { registerCustomer, loginUser } = require('../services/user_service');

router.post("/register", async (req, res) => {
  try {
    const response = await registerCustomer(req.body);
    return res.status(201).json(response);
  } catch (error) {
    if (error.message === "Email already registered") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  
  const [response, status] = await loginUser(email, password);
  return res.status(status).json(response);
});

module.exports = router;
