const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

// generate jwt token for authenticated user
function generateToken(user) {
  const payload = {
    user_id: user._id.toString(),
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  return jwt.sign(payload, config.JWT_SECRET_KEY);
}

// register new customer
async function registerCustomer(data) {
  const { email, password, name } = data;
  
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already registered");
  }
  
  const hashed = await bcrypt.hash(password, 10);
  
  const user = new User({
    email,
    password_hash: hashed,
    name,
    role: "Customer",
    status: "PendingApproval"
  });
  
  await user.save();
  
  return { message: "Registration successful, pending approval.", user_id: user._id.toString() };
}

async function processRegistrationApproval(managerId, userId, decision, reason = null) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return { error: "Unauthorized. Only managers can approve registrations." }, 403;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return { error: "User not found." }, 404;
  }
  
  if (decision === "APPROVE") {
    user.status = "Active";
  } else if (decision === "REJECT") {
    user.status = "Rejected";
    user.rejectionReason = reason;
  } else {
    return { error: "Invalid decision. Use 'APPROVE' or 'REJECT'." }, 400;
  }
  
  await user.save();
  return { message: `User ${decision.toLowerCase()}ed.` }, 200;
}

async function loginUser(email, password) {
  const user = await User.findOne({ email });
  if (!user) {
    return { error: "Invalid email or password." }, 401;
  }
  
  if (["Rejected", "Blacklisted"].includes(user.status)) {
    return { error: "Account is not allowed to login." }, 403;
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return { error: "Invalid email or password." }, 401;
  }
  
  const token = generateToken(user);
  return { token, role: user.role, user_id: user._id.toString() }, 200;
}

async function depositMoney(userId, amount) {
  const user = await User.findById(userId);
  if (!user) {
    return { error: "User not found." }, 404;
  }
  
  if (amount <= 0) {
    return { error: "Deposit amount must be positive." }, 400;
  }
  
  user.balance += amount;
  await user.save();
  return { message: `Deposited $${amount.toFixed(2)}. New balance: $${user.balance.toFixed(2)}.` }, 200;
}

async function applyWarning(userId, reason = "") {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }
  
  user.warningCount += 1;
  
  if (["Customer", "VIP"].includes(user.role)) {
    if (user.role === "VIP") {
      if (user.warningCount >= 2) {
        user.isVIP = false;
        user.role = "Customer";
        user.warningCount = 0;
      }
    } else {
      if (user.warningCount >= 3) {
        user.status = "Deregistered";
        await user.save();
        return;
      }
    }
  }
  
  await user.save();
}

async function applyComplaintEffect(employeeId, entityType, weight) {
  const employee = await User.findById(employeeId);
  if (!employee) {
    return false;
  }
  
  employee.netComplaints += weight;
  
  if (["Chef", "DeliveryPerson"].includes(entityType) && employee.netComplaints >= 3) {
    if (employee.demotionsCount === 0) {
      employee.role = `Demoted_${entityType}`;
      employee.demotionsCount += 1;
      employee.netComplaints = 0;
    } else if (employee.demotionsCount >= 1) {
      employee.status = "Terminated";
    }
  }
  
  await employee.save();
  return true;
}

async function updateVipStatus(customerId) {
  const user = await User.findById(customerId);
  if (!user || !["Customer", "VIP"].includes(user.role)) {
    return false;
  }
  
  if (user.warningCount > 0) {
    return false;
  }
  
  if (user.totalSpent > 100 || user.orderCount >= 3) {
    user.isVIP = true;
    user.role = "VIP";
    await user.save();
    return true;
  }
  return false;
}

async function blacklistUser(managerId, userId) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return { error: "Unauthorized. Only managers can blacklist users." }, 403;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return { error: "User not found." }, 404;
  }
  
  user.status = "Blacklisted";
  await user.save();
  return { message: "User has been blacklisted." }, 200;
}

module.exports = {
  generateToken,
  registerCustomer,
  processRegistrationApproval,
  loginUser,
  depositMoney,
  applyWarning,
  applyComplaintEffect,
  updateVipStatus,
  blacklistUser
};
