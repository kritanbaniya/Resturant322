const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
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
  resolveFlaggedChatResponse,
  getFlaggedKbEntries,
  deleteKbEntry,
  unflagKbEntry
} = require('../services/manager_service');
const { tokenRequired } = require('../utils/auth');

router.get('/dashboard', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const alert = await checkUnresolvedComplaintsAlert();
  const pendingRegistrations = await getPendingRegistrations();
  const pendingComplaints = await getPendingComplaints();
  const pendingBids = await getPendingDeliveryBids();
  const flaggedAi = await getFlaggedAiResponses();
  
  return res.status(200).json({
    dashboard: {
      alert,
      pending_registrations: pendingRegistrations.length,
      pending_complaints: pendingComplaints.length,
      pending_bids: pendingBids.length,
      flagged_ai: flaggedAi.length
    }
  });
});

router.get('/registrations/pending', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const registrations = await getPendingRegistrations();
  return res.status(200).json({
    registrations,
    total: registrations.length
  });
});

router.post('/registrations/:user_id/approve', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.user_id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  
  const { decision, reason } = req.body;
  
  if (!decision) {
    return res.status(400).json({ error: "decision required (APPROVE or REJECT)" });
  }
  
  if (decision === "REJECT" && !reason) {
    return res.status(400).json({ error: "reason required for rejection (A1)" });
  }
  
  const [response, status] = await approveRegistration(req.current_user.id, req.params.user_id, decision, reason);
  return res.status(status).json(response);
});

router.get('/complaints/pending', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const complaints = await getPendingComplaints();
  return res.status(200).json({
    complaints,
    total: complaints.length
  });
});

router.post('/complaints/:complaint_id/resolve', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.complaint_id)) {
    return res.status(400).json({ error: "Invalid complaint ID" });
  }
  
  const { decision, escalation_note } = req.body;
  
  if (!decision) {
    return res.status(400).json({ error: "decision required (VALID, INVALID, or ESCALATED)" });
  }
  
  const [response, status] = await resolveComplaint(req.current_user.id, req.params.complaint_id, decision, escalation_note);
  return res.status(status).json(response);
});

router.get('/employees', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const employees = await getEmployees();
  return res.status(200).json({
    employees,
    total: employees.length
  });
});

router.post('/employees/hire', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const { user_id, role } = req.body;
  
  if (!user_id || !role) {
    return res.status(400).json({ error: "user_id and role required" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  
  const [response, status] = await hireEmployee(req.current_user.id, user_id, role);
  return res.status(status).json(response);
});

router.post('/employees/:user_id/fire', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.user_id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  
  const { reason } = req.body;
  const [response, status] = await fireEmployee(req.current_user.id, req.params.user_id, reason);
  return res.status(status).json(response);
});

router.post('/employees/:user_id/promote', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.user_id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  
  const [response, status] = await promoteEmployee(req.current_user.id, req.params.user_id);
  return res.status(status).json(response);
});

router.post('/employees/:user_id/bonus', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.user_id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Valid bonus amount required" });
  }
  
  const [response, status] = await payBonus(req.current_user.id, req.params.user_id, amount);
  return res.status(status).json(response);
});

router.get('/delivery-bids/pending', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const bids = await getPendingDeliveryBids();
  return res.status(200).json({
    bids,
    total: bids.length
  });
});

router.post('/delivery-bids/:bid_id/assign', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.bid_id)) {
    return res.status(400).json({ error: "Invalid bid ID" });
  }
  
  const { justification } = req.body;
  const [response, status] = await assignDeliveryWithJustification(req.current_user.id, req.params.bid_id, justification);
  return res.status(status).json(response);
});

router.get('/ai/flagged', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const flagged = await getFlaggedAiResponses();
  return res.status(200).json({
    flagged_responses: flagged,
    total: flagged.length
  });
});

router.post('/ai/flagged/:chat_id/correct', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.chat_id)) {
    return res.status(400).json({ error: "Invalid chat ID" });
  }
  
  const { corrected_answer } = req.body;
  
  if (!corrected_answer) {
    return res.status(400).json({ error: "corrected_answer required" });
  }
  
  const [response, status] = await updateKbFromFlagged(req.current_user.id, req.params.chat_id, corrected_answer);
  return res.status(status).json(response);
});

router.get('/alerts/complaints', tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const alert = await checkUnresolvedComplaintsAlert();
  return res.status(200).json(alert);
});

router.post("/approve-registration", async (req, res) => {
  const { manager_id, user_id, decision, reason } = req.body;
  
  if (!manager_id || !user_id || !decision) {
    return res.status(400).json({ error: "manager_id, user_id, and decision are required." });
  }
  
  const [response, status] = await approveRegistration(manager_id, user_id, decision, reason);
  return res.status(status).json(response);
});

router.post("/resolve-complaint", async (req, res) => {
  const { manager_id, complaint_id, decision } = req.body;
  
  if (!manager_id || !complaint_id || !decision) {
    return res.status(400).json({ error: "manager_id, complaint_id, and decision are required." });
  }
  
  const [response, status] = await resolveComplaint(manager_id, complaint_id, decision);
  return res.status(status).json(response);
});

router.post("/kb/add", async (req, res) => {
  const { question, answer, keywords } = req.body;
  
  if (!question || !answer) {
    return res.status(400).json({ error: "question and answer are required." });
  }
  
  const [response, status] = await addKbEntry(question, answer, keywords || []);
  return res.status(status).json(response);
});

router.put("/kb/update/:entry_id", async (req, res) => {
  const { answer } = req.body;
  
  if (!answer) {
    return res.status(400).json({ error: "answer is required." });
  }
  
  const [response, status] = await updateKbEntry(req.params.entry_id, answer);
  return res.status(status).json(response);
});

router.get("/chat/flagged", async (req, res) => {
  try {
    const response = await getFlaggedChatResponses();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/chat/resolve/:chat_id", async (req, res) => {
  const { corrected_answer } = req.body;
  
  if (!corrected_answer) {
    return res.status(400).json({ error: "corrected_answer is required." });
  }
  
  const [response, status] = await resolveFlaggedChatResponse(req.params.chat_id, corrected_answer);
  return res.status(status).json(response);
});

router.get("/kb/flagged", tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const [response, status] = await getFlaggedKbEntries();
  return res.status(status).json(response);
});

router.delete("/kb/:entry_id", tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.entry_id)) {
    return res.status(400).json({ error: "Invalid KB entry ID" });
  }
  
  const [response, status] = await deleteKbEntry(req.current_user.id, req.params.entry_id);
  return res.status(status).json(response);
});

router.post("/kb/:entry_id/unflag", tokenRequired, async (req, res) => {
  if (req.current_user.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.entry_id)) {
    return res.status(400).json({ error: "Invalid KB entry ID" });
  }
  
  const [response, status] = await unflagKbEntry(req.current_user.id, req.params.entry_id);
  return res.status(status).json(response);
});

module.exports = router;
