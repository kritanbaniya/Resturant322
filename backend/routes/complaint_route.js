const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { applyWarning, applyComplaintEffect } = require('../services/user_service');
const { tokenRequired } = require('../utils/auth');
const mongoose = require('mongoose');

router.get("/test", (req, res) => {
  console.log("Test endpoint called!");
  return res.status(200).json({ message: "Complaints API is working!" });
});

router.post("/file", tokenRequired, async (req, res) => {
  const data = req.body;
  console.log("Received complaint data:", data);
  
  // use authenticated user id instead of body from_user
  const fromUser = req.current_user.id;
  const targetId = data.to_user;
  const message = data.text;
  let entityType = data.entity_type || "General";
  const rating = data.rating || 0;
  let weight = data.weight || 1;
  const isComplaint = data.isComplaint !== undefined ? data.isComplaint : true;
  
  // vip complaints count twice as important
  if (req.current_user.isVIP === true) {
    weight = weight * 2;
  }
  
  console.log(`from_user: ${fromUser}, target_id: ${targetId}, message: ${message}, entity_type: ${entityType}`);
  
  if (!targetId || !message) {
    const errorMsg = `Missing fields - to_user: ${!!targetId}, text: ${!!message}`;
    console.log(errorMsg);
    return res.status(400).json({ error: errorMsg });
  }
  
  if (!entityType || entityType === "") {
    entityType = "General";
  }
  
  const userFrom = await User.findById(fromUser);
  if (!userFrom) {
    console.log(`User not found with ID: ${fromUser}`);
    return res.status(404).json({ error: `User not found with ID: ${fromUser}` });
  }
  
  console.log(`Found user: ${userFrom.name} (ID: ${userFrom._id})`);
  
  let userTo = null;
  try {
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      userTo = await User.findById(targetId);
      if (userTo) {
        console.log(`Found target user: ${userTo.name} (ID: ${userTo._id})`);
      } else {
        console.log(`Target ID is a valid ObjectId but user not found: ${targetId}`);
      }
    } else {
      console.log(`Target ID is not a valid ObjectId, storing as raw ID: ${targetId}`);
    }
  } catch (error) {
    console.log(`Error checking target user: ${error.message}`);
    userTo = null;
  }
  
  try {
    console.log(`Creating complaint with: fromUser=${userFrom._id}, toUser=${userTo ? userTo._id : null}, targetId=${targetId}, entityType=${entityType}, message=${message.substring(0, 50)}...`);
    
    const complaint = new Complaint({
      fromUser: userFrom._id,
      toUser: userTo ? userTo._id : null,
      targetId: targetId,
      message: message,
      entityType: entityType,
      rating: rating,
      weight: weight,
      isComplaint: isComplaint
    });
    
    console.log("Complaint object created, attempting to save...");
    await complaint.save();
    console.log("Complaint saved successfully!");
    
    return res.status(201).json({
      message: "Complaint filed successfully.",
      complaint_id: complaint._id.toString()
    });
  } catch (error) {
    console.log(`Error saving complaint: ${error.message}`);
    console.log(error.stack);
    return res.status(400).json({ error: `Validation Error: ${error.message}` });
  }
});

router.get("/received/:user_id", tokenRequired, async (req, res) => {
  // verify user_id matches authenticated user
  if (req.current_user.id !== req.params.user_id && req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. You can only access your own received complaints." });
  }
  
  const complaints = await Complaint.find({ toUser: req.params.user_id }).populate('fromUser', 'name');
  
  return res.status(200).json(complaints.map(c => ({
    id: c._id.toString(),
    from: c.fromUser ? c.fromUser._id.toString() : "Unknown",
    from_name: c.fromUser ? c.fromUser.name : "Unknown",
    target_id: c.targetId,
    entity_type: c.entityType,
    text: c.message,
    weight: c.weight,
    is_complaint: c.isComplaint,
    status: c.status,
    created_at: c.created_at
  })));
});

router.get("/submitted/:user_id", tokenRequired, async (req, res) => {
  // verify user_id matches authenticated user
  if (req.current_user.id !== req.params.user_id && req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. You can only access your own submitted complaints." });
  }
  
  const complaints = await Complaint.find({ fromUser: req.params.user_id }).populate('toUser', 'name');
  
  return res.status(200).json(complaints.map(c => ({
    id: c._id.toString(),
    to: c.toUser ? c.toUser._id.toString() : c.targetId,
    to_name: c.toUser ? c.toUser.name : "N/A",
    target_id: c.targetId,
    entity_type: c.entityType,
    text: c.message,
    weight: c.weight,
    is_complaint: c.isComplaint,
    status: c.status,
    created_at: c.created_at
  })));
});

router.get("/pending", tokenRequired, async (req, res) => {
  // only managers can see pending complaints
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. Only managers can view pending complaints." });
  }
  
  const complaints = await Complaint.find({ status: "PendingReview" })
    .populate('fromUser', 'name')
    .populate('toUser', 'name');
  
  return res.status(200).json(complaints.map(c => ({
    id: c._id.toString(),
    from: c.fromUser ? c.fromUser._id.toString() : "Unknown",
    from_name: c.fromUser ? c.fromUser.name : "Unknown",
    to: c.toUser ? c.toUser._id.toString() : null,
    to_name: c.toUser ? c.toUser.name : "N/A",
    target_id: c.targetId,
    entity_type: c.entityType,
    text: c.message,
    rating: c.rating,
    weight: c.weight,
    is_complaint: c.isComplaint,
    status: c.status,
    created_at: c.created_at
  })));
});

router.put("/resolve/:complaint_id", tokenRequired, async (req, res) => {
  // only managers can resolve complaints
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. Only managers can resolve complaints." });
  }
  
  const { outcome, reason } = req.body;
  
  if (!["Valid", "Invalid"].includes(outcome)) {
    return res.status(400).json({ error: "Outcome must be 'Valid' or 'Invalid'" });
  }
  
  const complaint = await Complaint.findById(req.params.complaint_id).populate('toUser');
  if (!complaint) {
    return res.status(404).json({ error: "Complaint not found" });
  }
  
  if (complaint.status !== "PendingReview") {
    return res.status(400).json({ error: "Complaint already resolved" });
  }
  
  if (outcome === "Valid") {
    await complaint.mark_valid();
    
    if (complaint.toUser && ["Chef", "DeliveryPerson"].includes(complaint.entityType)) {
      await applyComplaintEffect(complaint.toUser._id.toString(), complaint.entityType, complaint.weight);
      return res.status(200).json({
        message: "Complaint marked as Valid. Punishment applied to employee.",
        complaint_id: complaint._id.toString()
      });
    } else {
      return res.status(200).json({
        message: "Complaint marked as Valid (no employee punishment applicable).",
        complaint_id: complaint._id.toString()
      });
    }
  } else {
    await complaint.mark_invalid();
    // use complaint.fromUser (populated) or complaint.fromUser from db
    const fromUserId = complaint.fromUser._id ? complaint.fromUser._id.toString() : complaint.fromUser.toString();
    await applyWarning(fromUserId, reason);
    
    return res.status(200).json({
      message: "Complaint marked as Invalid. Warning applied to complainer.",
      complaint_id: complaint._id.toString()
    });
  }
});

module.exports = router;
