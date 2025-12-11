from models.user import User
from models.order import Order
from models.order import OrderItem
from models.dish import Dish
from services.user_service import apply_warning, update_vip_status
import datetime

def create_order(customer_id, items):
    customer = User.objects(id=customer_id).first()
    if not customer or customer.status != "Active":
        return {"error": "Invalid or inactive customer."}, 400
    
    order_items = []
    for item in items:
        dish = Dish.objects(id=item['dish_id']).first()
        if not dish or not dish.isAvailable:
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
    order.calculate_total_price()
    
    return {
        "order_id": str(order.id),
        "original_price": order.original_price,
        "discount_applied": order.discount_applied,
        "final_price": order.final_price
    }, 201

def confirm_order(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404
    
    customer = order.customer
    
    if customer.balance < order.final_price:
        order.set_status("Rejected_Insufficient_Funds")
        apply_warning(customer.id, "Insufficient funds for order payment.")
        return {
            "error": "Insufficient funds.",
            "balance": customer.balance,
        }, 400
    
    customer.balance -= order.final_price
    customer.totalSpent += order.final_price
    customer.orderCount += 1
    customer.save()

    order.increment_dish_order_counts()
    update_vip_status(customer.id)
    order.set_status("Paid")
    order.set_status("Queued_For_Preparation")
    return {
        "message": "Order confirmed and paid successfully. Order sent to kitchen.",
        "order_id": str(order.id)
    }, 200

def get_customer_orders(customer_id):
    orders = Order.objects(customer=customer_id).order_by('-created_at')
    return [
        {"id": str(order.id),
         "status": order.status,
         "final_price": order.final_price,
         "created_at": order.created_at
         } for order in orders
    ]