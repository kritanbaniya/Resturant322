const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
  submitBid,
  assignDelivery,
  getAssignedDeliveries,
  getDeliveryDetails,
  confirmPickup,
  updateDeliveryStatus,
  evaluateDeliveryPerformance,
  getDeliveryHistory,
  getAvailableOrders
} = require('../services/delivery_service');
const { tokenRequired } = require('../utils/auth');

// specific routes must come before parameterized routes
router.get("/available", tokenRequired, async (req, res) => {
  try {
    if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    const orders = await getAvailableOrders(req.current_user.id);
    return res.status(200).json({
      orders,
      total: orders.length
    });
  } catch (error) {
    console.error("Error loading available orders:", error);
    return res.status(500).json({ error: "Failed to load available orders", details: error.message });
  }
});

router.get('/assignments/:delivery_person_id', tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (req.current_user.id !== req.params.delivery_person_id) {
    return res.status(403).json({ error: "Cannot view other delivery person's assignments" });
  }
  
  const deliveries = await getAssignedDeliveries(req.params.delivery_person_id);
  return res.status(200).json({
    deliveries,
    total: deliveries.length
  });
});

router.get('/:delivery_id', tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.delivery_id)) {
    return res.status(400).json({ error: "Invalid delivery ID" });
  }
  
  const [result, statusCode] = await getDeliveryDetails(req.current_user.id, req.params.delivery_id);
  return res.status(statusCode).json(result);
});

router.post('/pickup/:delivery_id', tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.delivery_id)) {
    return res.status(400).json({ error: "Invalid delivery ID" });
  }
  
  const [result, statusCode] = await confirmPickup(req.current_user.id, req.params.delivery_id);
  return res.status(statusCode).json(result);
});

router.post('/confirm/:delivery_id', tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.delivery_id)) {
    return res.status(400).json({ error: "Invalid delivery ID" });
  }
  
  const [result, statusCode] = await updateDeliveryStatus(req.current_user.id, req.params.delivery_id, "Delivered");
  return res.status(statusCode).json(result);
});

router.post('/failed/:delivery_id', tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.delivery_id)) {
    return res.status(400).json({ error: "Invalid delivery ID" });
  }
  
  const reason = req.body.reason || 'No reason provided';
  const [result, statusCode] = await updateDeliveryStatus(req.current_user.id, req.params.delivery_id, "Delivery_Failed", reason);
  return res.status(statusCode).json(result);
});

router.get('/performance/:delivery_person_id', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager" && req.current_user.id !== req.params.delivery_person_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.delivery_person_id)) {
    return res.status(400).json({ error: "Invalid delivery person ID" });
  }
  
  const [result, statusCode] = await evaluateDeliveryPerformance(req.params.delivery_person_id);
  return res.status(statusCode).json(result);
});

router.get('/history/:delivery_person_id', tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (req.current_user.id !== req.params.delivery_person_id) {
    return res.status(403).json({ error: "Cannot view other delivery person's history" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.delivery_person_id)) {
    return res.status(400).json({ error: "Invalid delivery person ID" });
  }
  
  const limit = parseInt(req.query.limit) || 20;
  const deliveries = await getDeliveryHistory(req.params.delivery_person_id, limit);
  return res.status(200).json({
    deliveries,
    total: deliveries.length
  });
});

router.post("/bid", tokenRequired, async (req, res) => {
  if (!["DeliveryPerson", "Demoted_DeliveryPerson"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const { order_id, amount } = req.body;
  
  if (!order_id || amount === undefined) {
    return res.status(400).json({ error: "order_id and amount are required." });
  }
  
  const [response, status] = await submitBid(req.current_user.id, order_id, amount);
  return res.status(status).json(response);
});

router.post("/assign", async (req, res) => {
  const { manager_id, bid_id, justification } = req.body;
  
  if (!manager_id || !bid_id) {
    return res.status(400).json({ error: "manager_id and bid_id are required." });
  }
  
  const [response, status] = await assignDelivery(manager_id, bid_id, justification);
  return res.status(status).json(response);
});

router.post("/update-status/:delivery_id", async (req, res) => {
  const { delivery_person_id, status, note } = req.body;
  
  if (!delivery_person_id || !status) {
    return res.status(400).json({ error: "delivery_person_id and status are required." });
  }
  
  const [response, statusCode] = await updateDeliveryStatus(delivery_person_id, req.params.delivery_id, status, note);
  return res.status(statusCode).json(response);
});

module.exports = router;
