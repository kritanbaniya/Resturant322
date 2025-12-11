from models.user import User
from models.order import Order
from models.order import OrderItem
from models.dish import Dish
from services.user_service import apply_warning, update_vip_status
import datetime

"""
UC-01: Order Food
Actors: Customer, VIP Customer
Preconditions:
1. User is logged in as Customer or VIP
2. User has positive deposited balance

Main Flow:
1. Customer browses/searches menu
2. Customer selects dish and adds to cart
3. Customer proceeds to checkout
4. System displays order summary and total price (with VIP discount if applicable)
5. Customer confirms order
6. System verifies balance is sufficient
7. System deducts order price from deposit
8. System sends order to Chef for preparation

Alternate Flows:
A1: Insufficient Funds
  - Order rejected at step 6
  - System issues warning for being "reckless"
  - Error message displayed

A2: Become VIP
  - Customer becomes VIP after: totalSpent > $100 OR orderCount >= 3 (without warnings)

A3: Warnings
  - 1 warning for rejected order (insufficient funds)
  - 1 warning for dismissed complaint
  - Regular Customers: 3 warnings → Deregistered
  - VIPs: 2 warnings → Demoted to Customer (warnings cleared)
"""

# create a new order (UC-01: Order Food)
def create_order(customer_id, items):
    customer = User.objects(id=customer_id).first()
    
    # Precondition 1: User must be logged in as Customer or VIP
    if not customer or customer.role not in ["Customer", "VIP"]:
        return {"error": "Invalid customer. Must be logged in as Customer or VIP."}, 400
    
    # Precondition 2: User must have Active status
    if customer.status != "Active":
        return {"error": "Account is not active."}, 400
    
    # Precondition 3: User must have positive balance
    if customer.balance <= 0:
        return {"error": "Insufficient balance. Please deposit funds first."}, 400
    
    order_items = []
    for item in items:
        dish = Dish.objects(id=item['dish_id']).first()
        if not dish or not dish.is_available:
            return {"error": f"Dish with id {item['dish_id']} not found or unavailable."}, 400
        order_item = OrderItem(
            dish=dish,
            quantity=item["quantity"],
            price=dish.price
        )
        order_items.append(order_item)
    
    order = Order(
        customer=customer,
        items=order_items,
        status="PendingPayment",
    )
    order.save()
    order.calculate_total_price()  # Applies VIP discount if applicable
    
    return {
        "order_id": str(order.id),
        "original_price": order.original_price,
        "discount_applied": order.discount_applied,
        "final_price": order.final_price,
        "customer_balance": customer.balance
    }, 201

# confirm and pay for an order (UC-01: Step 5-8)
def confirm_order(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404
    
    customer = order.customer
    
    # Step 6: Verify customer's balance is sufficient (A1: Insufficient Funds)
    if customer.balance < order.final_price:
        order.set_status("Rejected_Insufficient_Funds")
        
        # A1: Apply warning for being "reckless" (A3: Warnings rule)
        apply_warning(str(customer.id), "Reckless order attempt with insufficient funds")
        
        return {
            "error": "Insufficient funds. Order rejected. Warning applied.",
            "balance": customer.balance,
            "required": order.final_price
        }, 400
    
    # Step 7: Deduct order price from customer's deposit
    customer.balance -= order.final_price
    customer.totalSpent += order.final_price
    customer.orderCount += 1
    customer.save()

    order.increment_dish_order_counts()
    
    # A2: Become VIP (totalSpent > $100 OR orderCount >= 3, no warnings)
    vip_upgraded = update_vip_status(str(customer.id))
    
    # Step 8: Send order to Chef(s) for preparation
    order.set_status("Paid")
    order.set_status("Queued_For_Preparation")
    
    message = "Order confirmed and paid successfully. Order sent to kitchen."
    if vip_upgraded:
        message += " Congratulations! You've been upgraded to VIP status!"
    
    return {
        "message": message,
        "order_id": str(order.id),
        "new_balance": customer.balance,
        "vip_upgraded": vip_upgraded
    }, 200

# get orders for a customer
def get_customer_orders(customer_id):
    orders = Order.objects(customer=customer_id).order_by('-created_at')
    return [
        {"id": str(order.id),
         "status": order.status,
         "final_price": order.final_price,
         "original_price": order.original_price,
         "discount_applied": order.discount_applied,
         "created_at": order.created_at,
         "items": [
             {
                 "dish_name": item.dish.name,
                 "quantity": item.quantity,
                 "price": item.price
             } for item in order.items
         ]
         } for order in orders
    ]