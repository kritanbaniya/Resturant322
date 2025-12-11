const express = require('express');
const router = express.Router();
const {
  getOrdersForPreparation,
  getOrderDetails,
  startPreparation,
  completePreparation,
  setOrderOnHold,
  getChefOrders,
  evaluateChefPerformance
} = require('../services/chef_service');
const User = require('../models/User');

router.get("/queue", async (req, res) => {
  const orders = await getOrdersForPreparation();
  return res.status(200).json(orders);
});

router.get("/:order_id", async (req, res) => {
  const [response, status] = await getOrderDetails(req.params.order_id);
  return res.status(status).json(response);
});

router.post("/start/:order_id", async (req, res) => {
  const [response, status] = await startPreparation(req.params.order_id);
  return res.status(status).json(response);
});

router.post("/complete/:order_id", async (req, res) => {
  const [response, status] = await completePreparation(req.params.order_id);
  return res.status(status).json(response);
});

router.post("/hold/:order_id", async (req, res) => {
  const { note } = req.body;
  
  if (!note) {
    return res.status(400).json({ error: "note is required" });
  }
  
  const [response, status] = await setOrderOnHold(req.params.order_id, note);
  return res.status(status).json(response);
});

router.get("/dashboard/:chef_id", async (req, res) => {
  const chef = await User.findById(req.params.chef_id);
  if (!chef || !["Chef", "Demoted_Chef"].includes(chef.role)) {
    return res.status(403).json({ error: "Unauthorized. Only chefs can access this." });
  }
  
  const orders = await getChefOrders(req.params.chef_id);
  return res.status(200).json(orders);
});

router.get("/performance/:chef_id", async (req, res) => {
  const chef = await User.findById(req.params.chef_id);
  if (!chef || !["Chef", "Demoted_Chef"].includes(chef.role)) {
    return res.status(403).json({ error: "Unauthorized. Only chefs can access this." });
  }
  
  const [result, status] = await evaluateChefPerformance(req.params.chef_id);
  return res.status(status).json(result);
});

module.exports = router;
