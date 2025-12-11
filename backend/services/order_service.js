const User = require('../models/User');
const Order = require('../models/Order');
const Dish = require('../models/Dish');
const { applyWarning, updateVipStatus } = require('./user_service');

// create a new order
async function createOrder(customerId, items) {
  const customer = await User.findById(customerId);
  
  if (!customer || !["Customer", "VIP"].includes(customer.role)) {
    return [{ error: "Invalid customer. Must be logged in as Customer or VIP." }, 400];
  }
  
  if (customer.status !== "Active") {
    return [{ error: "Account is not active." }, 400];
  }
  
  const orderItems = [];
  for (const item of items) {
    const dish = await Dish.findById(item.dish_id);
    if (!dish || !dish.is_available) {
      return [{ error: `Dish with id ${item.dish_id} not found or unavailable.` }, 400];
    }
    orderItems.push({
      dish: dish._id,
      quantity: item.quantity,
      price: dish.price
    });
  }
  
  const order = new Order({
    customer: customer._id,
    items: orderItems,
    status: "Paid"
  });
  
  await order.save();
  order.customer = customer; // attach customer object for vip check
  await order.calculate_total_price();
  
  // check if customer has sufficient balance
  if (customer.balance < order.final_price) {
    // delete the order since payment failed
    await Order.findByIdAndDelete(order._id);
    await applyWarning(customer._id.toString(), "Order attempt with insufficient funds");
    
    return [{
      error: "Insufficient funds. Order not created.",
      balance: customer.balance,
      required: order.final_price
    }, 400];
  }
  
  // deduct payment immediately
  customer.balance -= order.final_price;
  customer.totalSpent += order.final_price;
  customer.orderCount += 1;
  await customer.save();
  
  await order.increment_dish_order_counts();
  
  const vipUpgraded = await updateVipStatus(customer._id.toString());
  
  // set status to queued for preparation
  await order.set_status("Queued_For_Preparation");
  
  let message = "Order created and paid successfully. Order sent to kitchen.";
  if (vipUpgraded) {
    message += " Congratulations! You've been upgraded to VIP status!";
  }
  
  return [{
    message,
    order_id: order._id.toString(),
    original_price: order.original_price,
    discount_applied: order.discount_applied,
    final_price: order.final_price,
    new_balance: customer.balance,
    vip_upgraded: vipUpgraded
  }, 201];
}

// confirm and pay for an order
async function confirmOrder(orderId) {
  const order = await Order.findById(orderId).populate('customer');
  if (!order) {
    return [{ error: "Order not found." }, 404];
  }
  
  const customer = order.customer;
  
  if (customer.balance < order.final_price) {
    await order.set_status("Rejected_Insufficient_Funds");
    await applyWarning(customer._id.toString(), "Order attempt with insufficient funds");
    
    return [{
      error: "Insufficient funds. Order rejected. Warning applied.",
      balance: customer.balance,
      required: order.final_price
    }, 400];
  }
  
  customer.balance -= order.final_price;
  customer.totalSpent += order.final_price;
  customer.orderCount += 1;
  await customer.save();
  
  await order.increment_dish_order_counts();
  
  const vipUpgraded = await updateVipStatus(customer._id.toString());
  
  await order.set_status("Paid");
  await order.set_status("Queued_For_Preparation");
  
  let message = "Order confirmed and paid successfully. Order sent to kitchen.";
  if (vipUpgraded) {
    message += " Congratulations! You've been upgraded to VIP status!";
  }
  
  return [{
    message,
    order_id: order._id.toString(),
    new_balance: customer.balance,
    vip_upgraded: vipUpgraded
  }, 200];
}

// get orders for a customer
async function getCustomerOrders(customerId) {
  const orders = await Order.find({ customer: customerId })
    .populate('items.dish')
    .sort({ created_at: -1 });
  
  return orders.map(order => ({
    id: order._id.toString(),
    status: order.status,
    final_price: order.final_price,
    original_price: order.original_price,
    discount_applied: order.discount_applied,
    created_at: order.created_at,
    items: order.items.map(item => ({
      dish_name: item.dish.name,
      quantity: item.quantity,
      price: item.price
    }))
  }));
}

module.exports = {
  createOrder,
  confirmOrder,
  getCustomerOrders
};
