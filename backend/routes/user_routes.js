const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { depositMoney, updateVipStatus } = require('../services/user_service');

router.get("/:user_id", async (req, res) => {
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

router.post("/deposit", async (req, res) => {
  const { user_id, amount } = req.body;
  
  if (!user_id || amount === undefined) {
    return res.status(400).json({ error: "user_id and amount are required." });
  }
  
  const [response, status] = await depositMoney(user_id, amount);
  return res.status(status).json(response);
});

router.put("/update-vip/:user_id", async (req, res) => {
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

router.get("/pending", async (req, res) => {
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
