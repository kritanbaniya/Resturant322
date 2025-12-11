const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { depositMoney, updateVipStatus } = require('../services/user_service');
const { tokenRequired } = require('../utils/auth');

router.get("/:user_id", tokenRequired, async (req, res) => {
  // verify user_id matches authenticated user (or user is manager)
  if (req.current_user.id !== req.params.user_id && req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. You can only access your own profile." });
  }
  
  const user = await User.findById(req.params.user_id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  
  const userData = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    balance: user.balance,
    totalSpent: user.totalSpent,
    orderCount: user.orderCount,
    isVIP: user.isVIP,
    status: user.status,
    warningCount: user.warningCount,
    netComplaints: user.netComplaints,
    demotionsCount: user.demotionsCount
  };
  return res.status(200).json(userData);
});

router.post("/deposit", tokenRequired, async (req, res) => {
  // use authenticated user id instead of body user_id
  const user_id = req.current_user.id;
  const { amount } = req.body;
  
  if (amount === undefined) {
    return res.status(400).json({ error: "amount is required." });
  }
  
  const [response, status] = await depositMoney(user_id, amount);
  return res.status(status).json(response);
});

router.put("/update-vip/:user_id", tokenRequired, async (req, res) => {
  // only managers can manually update vip status
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. Only managers can update VIP status." });
  }
  
  const user = await User.findById(req.params.user_id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  
  const updated = await updateVipStatus(req.params.user_id);
  if (!updated) {
    return res.status(400).json({ message: "User does not qualify for VIP status." });
  }
  
  return res.status(200).json({ message: "User promoted to VIP status." });
});

router.get("/pending", tokenRequired, async (req, res) => {
  // only managers can see pending registrations
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. Only managers can view pending registrations." });
  }
  
  const pendingUsers = await User.find({ status: "PendingApproval" });
  
  const usersList = pendingUsers.map(user => ({
    _id: user._id.toString(),
    email: user.email,
    name: user.name,
    status: user.status
  }));
  
  return res.status(200).json({ users: usersList });
});

module.exports = router;
