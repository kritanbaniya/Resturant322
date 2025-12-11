const { DeliveryBid, Delivery } = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

// delivery person submits a bid for an order
async function submitBid(deliveryPersonId, orderId, bidAmount) {
  const deliveryPerson = await User.findById(deliveryPersonId);
  if (!deliveryPerson || deliveryPerson.role !== "DeliveryPerson") {
    return [{ error: "Delivery person not found" }, 403];
  }
  
  const order = await Order.findById(orderId);
  if (!order || order.status !== "Ready_For_Delivery") {
    return [{ error: "Order not available for delivery bidding" }, 400];
  }
  
  const bid = new DeliveryBid({
    deliveryPerson: deliveryPerson._id,
    order: order._id,
    bid_amount: bidAmount,
    status: "Pending"
  });
  
  await bid.save();
  
  return [{ message: "Bid submitted successfully", bid_id: bid._id.toString() }, 201];
}

// manager assigns a delivery person based on bids
async function assignDelivery(managerId, bidId, justification = null) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return [{ error: "Unauthorized: Manager not found" }, 403];
  }
  
  const bid = await DeliveryBid.findById(bidId).populate('order');
  if (!bid) {
    return [{ error: "Bid not found" }, 404];
  }
  
  const lowestBid = await DeliveryBid.findOne({ order: bid.order._id })
    .sort({ bid_amount: 1 });
  
  if (bid.bid_amount > lowestBid.bid_amount && !justification) {
    return [{ error: "Justification required for accepting a higher bid" }, 400];
  }
  
  const otherBids = await DeliveryBid.find({ order: bid.order._id, status: "Pending" });
  for (const other of otherBids) {
    if (other._id.toString() !== bidId) {
      other.status = "Rejected";
      await other.save();
    }
  }
  
  bid.status = "Accepted";
  await bid.save();
  
  const delivery = new Delivery({
    order: bid.order._id,
    deliveryPerson: bid.deliveryPerson,
    bidAmount: bid.bid_amount,
    status: "Assigned"
  });
  
  await delivery.save();
  await bid.order.set_status("Awaiting_Pickup");
  
  return [{
    message: "Delivery assigned successfully",
    delivery_id: delivery._id.toString()
  }, 200];
}

// get assigned deliveries for delivery person
async function getAssignedDeliveries(deliveryPersonId) {
  const deliveries = await Delivery.find({
    deliveryPerson: deliveryPersonId,
    status: { $in: ["Assigned", "Out_For_Delivery"] }
  })
    .populate({
      path: 'order',
      populate: {
        path: 'customer',
        select: 'name phone address'
      }
    })
    .populate({
      path: 'order',
      populate: {
        path: 'items.dish',
        select: 'name'
      }
    })
    .sort({ created_at: -1 });
  
  return deliveries.map(d => ({
    delivery_id: d._id.toString(),
    order_id: d.order._id.toString(),
    customer_name: d.order.customer.name,
    customer_phone: d.order.customer.phone || "N/A",
    customer_address: d.order.customer.address || "N/A",
    items: d.order.items.map(item => item.dish.name),
    bid_amount: d.bidAmount,
    status: d.status,
    created_at: d.created_at
  }));
}

// get delivery details
async function getDeliveryDetails(deliveryPersonId, deliveryId) {
  const delivery = await Delivery.findById(deliveryId)
    .populate({
      path: 'order',
      populate: [
        { path: 'customer', select: 'name phone address' },
        { path: 'items.dish', select: 'name price' }
      ]
    });
  
  if (!delivery) {
    return [{ error: "Delivery not found" }, 404];
  }
  
  if (delivery.deliveryPerson.toString() !== deliveryPersonId) {
    return [{ error: "Unauthorized: Not your delivery" }, 403];
  }
  
  const order = delivery.order;
  
  return [{
    delivery_id: delivery._id.toString(),
    order_id: order._id.toString(),
    customer_name: order.customer.name,
    customer_phone: order.customer.phone || "N/A",
    customer_address: order.customer.address || "N/A",
    customer_notes: order.notes || "",
    items: order.items.map(item => ({
      dish_name: item.dish.name,
      quantity: item.quantity,
      price: item.price
    })),
    final_price: order.final_price,
    bid_amount: delivery.bidAmount,
    status: delivery.status,
    created_at: order.created_at
  }, 200];
}

// confirm pickup
async function confirmPickup(deliveryPersonId, deliveryId) {
  const delivery = await Delivery.findById(deliveryId).populate('order');
  if (!delivery) {
    return [{ error: "Delivery not found" }, 404];
  }
  
  if (delivery.deliveryPerson.toString() !== deliveryPersonId) {
    return [{ error: "Unauthorized" }, 403];
  }
  
  if (delivery.status !== "Assigned") {
    return [{ error: "Delivery not assigned or already started" }, 400];
  }
  
  await delivery.set_status("Out_For_Delivery");
  await delivery.order.set_status("Out_For_Delivery");
  
  return [{ message: "Pickup confirmed. Delivery in progress." }, 200];
}

// delivery person updates delivery status
async function updateDeliveryStatus(deliveryPersonId, deliveryId, newStatus, note = null) {
  const delivery = await Delivery.findById(deliveryId).populate('order');
  if (!delivery) {
    return [{ error: "Delivery not found" }, 404];
  }
  
  if (delivery.deliveryPerson.toString() !== deliveryPersonId) {
    return [{ error: "Unauthorized: Not the assigned delivery person" }, 403];
  }
  
  const order = delivery.order;
  
  if (newStatus === "Delivered") {
    await delivery.set_status("Delivered");
    await order.set_status("Completed");
    return [{ message: "Order delivered successfully" }, 200];
  }
  
  if (newStatus === "Delivery_Failed") {
    await delivery.set_status("Delivery_Failed", note);
    await order.set_status("Delivery_Failed");
    return [{
      message: "Delivery marked as failed. Manager will be notified.",
      note
    }, 200];
  }
  
  return [{ error: "Invalid status update" }, 400];
}

// evaluate delivery person performance
async function evaluateDeliveryPerformance(deliveryPersonId) {
  const deliveryPerson = await User.findById(deliveryPersonId);
  if (!deliveryPerson || !["DeliveryPerson", "Demoted_DeliveryPerson"].includes(deliveryPerson.role)) {
    return [{ error: "Invalid delivery person" }, 400];
  }
  
  const complaints = await Complaint.find({
    toUser: deliveryPersonId,
    status: "Valid",
    isComplaint: true
  });
  const compliments = await Complaint.find({
    toUser: deliveryPersonId,
    status: "Valid",
    isComplaint: false
  });
  
  const complaintCount = complaints.length;
  const complimentCount = compliments.length;
  const netComplaints = complaintCount - complimentCount;
  
  const ratings = complaints.filter(c => c.rating > 0).map(c => c.rating);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0;
  
  const result = {
    delivery_person_id: deliveryPersonId.toString(),
    complaint_count: complaintCount,
    compliment_count: complimentCount,
    net_complaints: netComplaints,
    avg_rating: Math.round(avgRating * 100) / 100,
    action: "none"
  };
  
  if ((avgRating < 2.0 || netComplaints >= 3) && deliveryPerson.role === "DeliveryPerson") {
    if (deliveryPerson.demotionsCount === 0) {
      deliveryPerson.role = "Demoted_DeliveryPerson";
      deliveryPerson.demotionsCount += 1;
      await deliveryPerson.save();
      result.action = "demoted";
      result.message = "Delivery person has been demoted due to poor performance";
    } else if (deliveryPerson.demotionsCount >= 1) {
      deliveryPerson.status = "Terminated";
      await deliveryPerson.save();
      result.action = "terminated";
      result.message = "Delivery person has been terminated";
    }
  }
  
  if (avgRating > 4.0 || complimentCount >= 3) {
    if (deliveryPerson.status === "Active") {
      result.action = "bonus";
      result.message = "Delivery person is eligible for performance bonus!";
    }
  }
  
  return [result, 200];
}

// get delivery history for delivery person
async function getDeliveryHistory(deliveryPersonId, limit = 20) {
  const deliveries = await Delivery.find({
    deliveryPerson: deliveryPersonId,
    status: { $in: ["Delivered", "Delivery_Failed"] }
  })
    .populate('order', 'customer')
    .sort({ updated_at: -1 })
    .limit(limit);
  
  return deliveries.map(d => ({
    delivery_id: d._id.toString(),
    order_id: d.order._id.toString(),
    customer_name: d.order.customer.name,
    status: d.status,
    bid_amount: d.bidAmount,
    completed_at: d.updated_at
  }));
}

module.exports = {
  submitBid,
  assignDelivery,
  getAssignedDeliveries,
  getDeliveryDetails,
  confirmPickup,
  updateDeliveryStatus,
  evaluateDeliveryPerformance,
  getDeliveryHistory
};
