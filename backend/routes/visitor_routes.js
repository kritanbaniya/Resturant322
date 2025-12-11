const express = require('express');
const router = express.Router();
const Dish = require('../models/Dish');
const mongoose = require('mongoose');
const { askAi, rateAnswer, flagAnswer, getAiStatus } = require('../services/chat_service');

router.get('/menu', async (req, res) => {
  try {
    const dishes = await Dish.find({});
    const menu = dishes.map(d => ({
      id: d._id.toString(),
      name: d.name,
      price: d.price,
      description: d.description,
      image_url: d.image_url,
      available: d.is_available !== undefined ? d.is_available : true,
      preparation_time: d.preparation_time || "30 mins"
    }));
    
    return res.status(200).json({
      message: "Menu retrieved successfully",
      menu
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const question = (req.body.question || '').trim();
    
    if (!question) {
      return res.status(400).json({ error: "Question cannot be empty" });
    }
    
    const [response, status] = await askAi(null, question);
    return res.status(status).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/chat/:answer_id/rate', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.answer_id)) {
      return res.status(400).json({ error: "Invalid answer ID" });
    }
    
    const { rating } = req.body;
    
    if (rating === undefined) {
      return res.status(400).json({ error: "Rating is required" });
    }
    
    const [response, status] = await rateAnswer(req.params.answer_id, rating);
    return res.status(status).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/chat/:answer_id/flag', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.answer_id)) {
      return res.status(400).json({ error: "Invalid answer ID" });
    }
    
    const reason = req.body.reason;
    const [response, status] = await flagAnswer(req.params.answer_id, reason);
    return res.status(status).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/register', (req, res) => {
  return res.status(200).json({
    message: "Register to save your preferences and place orders",
    redirect_url: "/register.html",
    note: "Visitors can browse menu and chat with AI, but need to register to place orders"
  });
});

router.get('/chat/status', async (req, res) => {
  try {
    const response = getAiStatus();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/action', (req, res) => {
  try {
    const { action_type, details } = req.body;
    const actionType = (action_type || '').trim();
    
    if (!actionType) {
      return res.status(400).json({ error: "action_type is required" });
    }
    
    return res.status(200).json({
      message: `Action logged: ${actionType}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
