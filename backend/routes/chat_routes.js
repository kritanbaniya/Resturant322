const express = require('express');
const router = express.Router();
const { askAi, rateAnswer, reviewKbAnswer, flagAnswer, getChatHistory } = require('../services/chat_service');

router.post("/ask", async (req, res) => {
  const { user_id, question } = req.body;
  
  if (!user_id || !question) {
    return res.status(400).json({ error: "user_id and question are required." });
  }
  
  const [response, status] = await askAi(user_id, question);
  return res.status(status).json(response);
});

router.post("/rate", async (req, res) => {
  const { answer_id, rating } = req.body;
  
  if (answer_id === undefined || rating === undefined) {
    return res.status(400).json({ error: "answer_id and rating are required." });
  }
  
  const [response, status] = await rateAnswer(answer_id, parseInt(rating));
  return res.status(status).json(response);
});

router.post("/review-kb", async (req, res) => {
  const { answer_id, rating } = req.body;
  
  if (answer_id === undefined || rating === undefined) {
    return res.status(400).json({ error: "answer_id and rating are required." });
  }
  
  const [response, status] = await reviewKbAnswer(answer_id, parseInt(rating));
  return res.status(status).json(response);
});

router.post("/flag", async (req, res) => {
  const { answer_id, reason } = req.body;
  
  if (answer_id === undefined) {
    return res.status(400).json({ error: "answer_id is required." });
  }
  
  const [response, status] = await flagAnswer(answer_id, reason);
  return res.status(status).json(response);
});

router.get("/history/:user_id", async (req, res) => {
  const [response, status] = await getChatHistory(req.params.user_id);
  return res.status(status).json(response);
});

module.exports = router;
