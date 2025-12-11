const express = require('express');
const router = express.Router();
const { createOrder, confirmOrder, getCustomerOrders } = require('../services/order_service');
const { tokenRequired } = require('../utils/auth');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// verify user is customer/vip before allowing access
const customerOnly = (req, res, next) => {
  if (!req.current_user || !["Customer", "VIP"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized. Only customers can access this." });
  }
  next();
};

router.post("/create", tokenRequired, customerOnly, async (req, res) => {
  // use authenticated user id instead of body customer_id
  const customer_id = req.current_user.id;
  const { items } = req.body;
  
  if (!items) {
    return res.status(400).json({ error: "items are required" });
  }
  
  const [response, status] = await createOrder(customer_id, items);
  return res.status(status).json(response);
});

router.post("/confirm/:order_id", tokenRequired, customerOnly, async (req, res) => {
  // verify order belongs to authenticated user
  const order = await Order.findById(req.params.order_id);
  if (!order) {
    return res.status(404).json({ error: "Order not found." });
  }
  
  if (order.customer.toString() !== req.current_user.id) {
    return res.status(403).json({ error: "Unauthorized. You can only confirm your own orders." });
  }
  
  const [response, status] = await confirmOrder(req.params.order_id);
  return res.status(status).json(response);
});

router.get("/history/:customer_id", tokenRequired, customerOnly, async (req, res) => {
  // verify customer_id matches authenticated user
  if (req.current_user.id !== req.params.customer_id) {
    return res.status(403).json({ error: "Unauthorized. You can only access your own order history." });
  }
  
  const orders = await getCustomerOrders(req.params.customer_id);
  return res.status(200).json(orders);
});

module.exports = router;
