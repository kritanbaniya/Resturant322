const User = require('../models/User');
const Complaint = require('../models/Complaint');
const KnowledgeBaseEntry = require('../models/KnowledgeBase');
const { ChatAnswer } = require('../models/Chat');
const { DeliveryBid } = require('../models/Delivery');
const Order = require('../models/Order');
const { assignDelivery } = require('./delivery_service');
const { applyComplaintEffect, applyWarning } = require('./user_service');

// get pending registrations
async function getPendingRegistrations() {
  const pending = await User.find({ status: "PendingApproval" }).sort({ created_at: -1 });
  
  return pending.map(u => ({
    user_id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone || "N/A",
    role: u.role,
    address: u.address || "N/A",
    created_at: u.created_at
  }));
}

// manager approval of user registrations
async function approveRegistration(managerId, userId, decision, reason = null) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized. Only managers can approve registrations." }, 403];
  }
  
  const user = await User.findById(userId);
  if (!user || user.status !== "PendingApproval") {
    return [{ error: "User not found or not pending approval." }, 404];
  }
  
  if (decision === "APPROVE") {
    user.status = "Active";
    const message = `User ${user.name} approved successfully.`;
    await user.save();
    return [{ message }, 200];
  } else if (decision === "REJECT") {
    user.status = "Rejected";
    user.rejectionReason = reason || "Application rejected by manager.";
    const message = `User ${user.name} rejected. Reason: ${reason || 'No reason provided'}`;
    await user.save();
    return [{ message }, 200];
  } else {
    return [{ error: "Invalid decision. Use 'APPROVE' or 'REJECT'." }, 400];
  }
}

// get pending complaints
async function getPendingComplaints() {
  const complaints = await Complaint.find({ status: "PendingReview" })
    .populate('fromUser', 'name')
    .populate('toUser', 'name')
    .sort({ created_at: -1 });
  
  return complaints.map(c => ({
    complaint_id: c._id.toString(),
    from_user: c.fromUser ? c.fromUser.name : "Unknown",
    to_user: c.toUser ? c.toUser.name : "Unknown",
    type: c.isComplaint ? "Complaint" : "Compliment",
    rating: c.rating,
    weight: c.weight,
    message: c.message || "",
    entity_type: c.entityType,
    created_at: c.created_at
  }));
}

// resolve complaint
async function resolveComplaint(managerId, complaintId, decision, escalationNote = null) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized. Only managers can resolve complaints." }, 403];
  }
  
  const complaint = await Complaint.findById(complaintId).populate('toUser').populate('fromUser');
  if (!complaint) {
    return [{ error: "Complaint not found." }, 404];
  }
  
  const target = complaint.toUser;
  if (!target) {
    return [{ error: "Cannot resolve complaint without target user." }, 400];
  }
  
  let result = { message: "" };
  
  if (decision === "VALID") {
    await complaint.mark_valid();
    
    if (["Chef", "DeliveryPerson", "Demoted_Chef", "Demoted_DeliveryPerson"].includes(target.role)) {
      await applyComplaintEffect(target._id.toString(), complaint.entityType, complaint.weight);
      result.message = `Complaint marked VALID. Penalty applied to ${target.name}.`;
    } else {
      if (!complaint.isComplaint) {
        await applyWarning(complaint.fromUser._id.toString(), "Invalid compliment filed.");
        result.message = "Compliment marked VALID.";
      } else {
        result.message = "Complaint marked VALID.";
      }
    }
  } else if (decision === "INVALID") {
    await complaint.mark_invalid();
    await applyWarning(complaint.fromUser._id.toString(), `Invalid ${complaint.isComplaint ? 'complaint' : 'compliment'} filed.`);
    result.message = `Complaint marked INVALID. Warning applied to ${complaint.fromUser.name}.`;
  } else if (decision === "ESCALATED") {
    complaint.status = "Escalated";
    complaint.escalationNote = escalationNote || "Escalated for further review";
    await complaint.save();
    result.message = "Complaint ESCALATED for further investigation.";
  } else {
    return [{ error: "Invalid decision. Use 'VALID', 'INVALID', or 'ESCALATED'." }, 400];
  }
  
  return [result, 200];
}

// get all employees
async function getEmployees() {
  const employees = await User.find({
    role: { $in: ["Chef", "DeliveryPerson", "Demoted_Chef", "Demoted_DeliveryPerson"] },
    status: { $ne: "Terminated" }
  }).sort({ role: 1 });
  
  return employees.map(e => ({
    user_id: e._id.toString(),
    name: e.name,
    email: e.email,
    role: e.role,
    status: e.status,
    net_complaints: e.netComplaints,
    demotions: e.demotionsCount,
    warnings: e.warningCount,
    hired_date: e.created_at
  }));
}

// hire new employee
async function hireEmployee(managerId, userId, employeeRole) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized" }, 403];
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return [{ error: "User not found" }, 404];
  }
  
  if (!["Chef", "DeliveryPerson"].includes(employeeRole)) {
    return [{ error: "Invalid employee role" }, 400];
  }
  
  user.role = employeeRole;
  user.status = "Active";
  await user.save();
  return [{ message: `User ${user.name} hired as ${employeeRole}` }, 200];
}

// fire employee
async function fireEmployee(managerId, userId, reason = null) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized" }, 403];
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return [{ error: "User not found" }, 404];
  }
  
  user.role = "Customer";
  user.status = "Active";
  user.terminationReason = reason || "Terminated by manager";
  await user.save();
  return [{ message: `Employee ${user.name} fired and converted to customer.` }, 200];
}

// promote employee
async function promoteEmployee(managerId, userId) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized" }, 403];
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return [{ error: "User not found" }, 404];
  }
  
  let message = "";
  if (user.role === "Demoted_Chef") {
    user.role = "Chef";
    user.demotionsCount = 0;
    user.netComplaints = 0;
    message = "Chef promoted back to full Chef role";
  } else if (user.role === "Demoted_DeliveryPerson") {
    user.role = "DeliveryPerson";
    user.demotionsCount = 0;
    user.netComplaints = 0;
    message = "DeliveryPerson promoted back to full role";
  } else {
    return [{ error: "User is not in demoted status" }, 400];
  }
  
  await user.save();
  return [{ message }, 200];
}

// pay bonus
async function payBonus(managerId, userId, bonusAmount) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized" }, 403];
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return [{ error: "User not found" }, 404];
  }
  
  if (bonusAmount <= 0) {
    return [{ error: "Bonus amount must be positive" }, 400];
  }
  
  user.balance += bonusAmount;
  await user.save();
  
  return [{
    message: `Bonus of $${bonusAmount.toFixed(2)} paid to ${user.name}`,
    new_balance: user.balance
  }, 200];
}

// get pending delivery bids
async function getPendingDeliveryBids() {
  const bids = await DeliveryBid.find({ status: "Pending" })
    .populate('order', 'customer status items')
    .populate('deliveryPerson', 'name')
    .sort({ created_at: -1 });
  
  return bids.map(bid => ({
    bid_id: bid._id.toString(),
    order_id: bid.order._id.toString(),
    delivery_person: bid.deliveryPerson.name,
    bid_amount: bid.bid_amount,
    order_status: bid.order.status,
    customer: bid.order.customer.name,
    items_count: bid.order.items.length,
    created_at: bid.created_at
  }));
}

// assign delivery with justification
async function assignDeliveryWithJustification(managerId, bidId, justification = null) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized" }, 403];
  }
  
  const bid = await DeliveryBid.findById(bidId).populate('order');
  if (!bid) {
    return [{ error: "Bid not found" }, 404];
  }
  
  const lowestBid = await DeliveryBid.findOne({ order: bid.order._id, status: "Pending" })
    .sort({ bid_amount: 1 });
  
  if (bid.bid_amount > lowestBid.bid_amount && !justification) {
    return [{
      error: "Justification required for accepting higher bid",
      lowest_bid: lowestBid.bid_amount,
      selected_bid: bid.bid_amount
    }, 400];
  }
  
  return await assignDelivery(managerId, bidId, justification);
}

// get flagged ai responses
async function getFlaggedAiResponses() {
  const flagged = await ChatAnswer.find({ flagged: true }).sort({ created_at: -1 });
  
  return flagged.map(c => ({
    chat_id: c._id.toString(),
    question: c.queryText,
    answer: c.answerText,
    source: c.source || "Unknown",
    flag_reason: c.flagReason || "Marked as outrageous",
    created_at: c.created_at
  }));
}

// update knowledge base from flagged response
async function updateKbFromFlagged(managerId, chatId, correctedAnswer) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized" }, 403];
  }
  
  const answer = await ChatAnswer.findById(chatId);
  if (!answer) {
    return [{ error: "Chat answer not found" }, 404];
  }
  
  const kbEntry = new KnowledgeBaseEntry({
    questionText: answer.queryText,
    answerText: correctedAnswer,
    keywords: []
  });
  
  await kbEntry.save();
  
  answer.flagged = false;
  await answer.save();
  
  return [{
    message: "Knowledge base updated with corrected answer",
    kb_entry_id: kbEntry._id.toString()
  }, 200];
}

// system alert for unresolved complaints
async function checkUnresolvedComplaintsAlert() {
  const pending = await Complaint.find({ status: "PendingReview" });
  const count = pending.length;
  
  if (count >= 3) {
    return {
      alert: true,
      message: `URGENT: ${count} unresolved complaints requiring action`,
      pending_count: count
    };
  }
  
  return {
    alert: false,
    pending_count: count
  };
}

// add knowledge base entry
async function addKbEntry(question, answer, keywords = []) {
  const entry = new KnowledgeBaseEntry({
    questionText: question,
    answerText: answer,
    keywords
  });
  
  await entry.save();
  return { message: "Knowledge base entry added successfully.", entry_id: entry._id.toString() }, 201;
}

// update knowledge base entry
async function updateKbEntry(entryId, newAnswer) {
  const entry = await KnowledgeBaseEntry.findById(entryId);
  if (!entry) {
    return [{ error: "Knowledge base entry not found." }, 404];
  }
  
  await entry.update_answer(newAnswer);
  return [{ message: "Knowledge base entry updated successfully." }, 200];
}

// get flagged chat responses
async function getFlaggedChatResponses() {
  const flagged = await ChatAnswer.find({ flagged: true });
  return flagged.map(c => ({
    id: c._id.toString(),
    question: c.queryText,
    answer: c.answerText,
    source: c.source,
    created_at: c.created_at
  }));
}

// resolve flagged chat response
async function resolveFlaggedChatResponse(chatId, correctedAnswer) {
  const answer = await ChatAnswer.findById(chatId);
  if (!answer) {
    return [{ error: "Chat answer not found." }, 404];
  }
  
  const kbEntry = new KnowledgeBaseEntry({
    questionText: answer.queryText,
    answerText: correctedAnswer,
    keywords: []
  });
  
  await kbEntry.save();
  answer.flagged = false;
  await answer.save();
  
  return [{ message: "Flagged chat response resolved and knowledge base updated." }, 200];
}

module.exports = {
  getPendingRegistrations,
  approveRegistration,
  getPendingComplaints,
  resolveComplaint,
  getEmployees,
  hireEmployee,
  fireEmployee,
  promoteEmployee,
  payBonus,
  getPendingDeliveryBids,
  assignDeliveryWithJustification,
  getFlaggedAiResponses,
  updateKbFromFlagged,
  checkUnresolvedComplaintsAlert,
  addKbEntry,
  updateKbEntry,
  getFlaggedChatResponses,
  resolveFlaggedChatResponse
};
