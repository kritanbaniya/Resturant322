const express = require('express');
const router = express.Router();
const { createOrder, confirmOrder, getCustomerOrders } = require('../services/order_service');

router.post("/create", async (req, res) => {
  const { customer_id, items } = req.body;
  
  if (!customer_id || !items) {
    return res.status(400).json({ error: "customer_id and items are required" });
  }
  
  const [response, status] = await createOrder(customer_id, items);
  return res.status(status).json(response);
});

router.post("/confirm/:order_id", async (req, res) => {
  const [response, status] = await confirmOrder(req.params.order_id);
  return res.status(status).json(response);
});

router.get("/history/:customer_id", async (req, res) => {
  const orders = await getCustomerOrders(req.params.customer_id);
  return res.status(200).json(orders);
});

module.exports = router;
