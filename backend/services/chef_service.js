const Order = require('../models/Order');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

// orders for chefs to prepare
async function getOrdersForPreparation() {
  const orders = await Order.find({ status: "Queued_For_Preparation" })
    .populate('customer', 'name')
    .populate('items.dish', 'name')
    .sort({ created_at: 1 });
  
  return orders.map(order => ({
    order_id: order._id.toString(),
    customer_name: order.customer.name,
    customer_id: order.customer._id.toString(),
    items: order.items.map(item => ({
      dish: item.dish.name,
      quantity: item.quantity
    })),
    status: order.status,
    created_at: order.created_at
  }));
}

// get detailed order information for chef
async function getOrderDetails(orderId) {
  const order = await Order.findById(orderId)
    .populate('customer', 'name')
    .populate('items.dish', 'name description');
  
  if (!order) {
    return { error: "Order not found." }, 404;
  }
  
  return {
    order_id: order._id.toString(),
    customer_name: order.customer.name,
    customer_id: order.customer._id.toString(),
    customer_notes: order.notes,
    items: order.items.map(item => ({
      dish_name: item.dish.name,
      quantity: item.quantity,
      instructions: item.dish.description || ""
    })),
    status: order.status,
    created_at: order.created_at
  }, 200;
}

// start preparing an order
async function startPreparation(orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    return { error: "Order not found." }, 404;
  }
  
  if (order.status !== "Queued_For_Preparation") {
    return { error: "Order is not ready for preparation." }, 400;
  }
  
  await order.set_status("In_Preparation");
  return { message: "Order is now in preparation.", order_id: order._id.toString() }, 200;
}

// complete preparing an order
async function completePreparation(orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    return { error: "Order not found." }, 404;
  }
  
  if (order.status !== "In_Preparation") {
    return { error: "Order is not in preparation." }, 400;
  }
  
  await order.set_status("Ready_For_Delivery");
  return { message: "Order is ready for delivery.", order_id: order._id.toString() }, 200;
}

// put an order on hold due to ingredient shortage
async function setOrderOnHold(orderId, note) {
  const order = await Order.findById(orderId);
  if (!order) {
    return { error: "Order not found." }, 404;
  }
  
  if (!["Queued_For_Preparation", "In_Preparation"].includes(order.status)) {
    return { error: "Order cannot be put on hold in its current status." }, 400;
  }
  
  await order.set_status("On_Hold");
  await order.add_note(note);
  
  return {
    message: "Order has been put on hold due to ingredient shortage.",
    order_id: order._id.toString(),
    note
  }, 200;
}

// get chef's in-progress orders
async function getChefOrders(chefId) {
  const orders = await Order.find({
    status: { $in: ["In_Preparation", "Ready_For_Delivery", "On_Hold"] }
  })
    .populate('customer', 'name')
    .populate('items.dish', 'name')
    .sort({ updated_at: -1 });
  
  return orders.map(order => ({
    order_id: order._id.toString(),
    customer_name: order.customer.name,
    items: order.items.map(item => item.dish.name),
    status: order.status,
    updated_at: order.updated_at
  }));
}

// evaluate chef performance
async function evaluateChefPerformance(chefId) {
  const chef = await User.findById(chefId);
  if (!chef || !["Chef", "Demoted_Chef"].includes(chef.role)) {
    return { error: "Invalid chef." }, 400;
  }
  
  const complaints = await Complaint.find({ toUser: chefId, status: "Valid", isComplaint: true });
  const compliments = await Complaint.find({ toUser: chefId, status: "Valid", isComplaint: false });
  
  const complaintCount = complaints.length;
  const complimentCount = compliments.length;
  const netComplaints = complaintCount - complimentCount;
  
  const ratings = complaints.filter(c => c.rating > 0).map(c => c.rating);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0;
  
  const result = {
    chef_id: chefId.toString(),
    complaint_count: complaintCount,
    compliment_count: complimentCount,
    net_complaints: netComplaints,
    avg_rating: Math.round(avgRating * 100) / 100,
    action: "none"
  };
  
  if ((avgRating < 2.0 || netComplaints >= 3) && chef.role === "Chef") {
    if (chef.demotionsCount === 0) {
      chef.role = "Demoted_Chef";
      chef.demotionsCount += 1;
      await chef.save();
      result.action = "demoted";
      result.message = "Chef has been demoted due to poor performance (low ratings or multiple complaints)";
    } else if (chef.demotionsCount >= 1) {
      chef.status = "Terminated";
      await chef.save();
      result.action = "terminated";
      result.message = "Chef has been terminated after repeated poor performance";
    }
  }
  
  if (avgRating > 4.0 || complimentCount >= 3) {
    if (chef.status === "Active") {
      result.action = "bonus";
      result.message = "Chef is eligible for performance bonus!";
    }
  }
  
  return result, 200;
}

module.exports = {
  getOrdersForPreparation,
  getOrderDetails,
  startPreparation,
  completePreparation,
  setOrderOnHold,
  getChefOrders,
  evaluateChefPerformance
};
