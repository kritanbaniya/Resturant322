from models.order import Order
from models.user import User
from models.complaint import Complaint

"""
UC-02: Cook Food
Actor: Chef
Preconditions:
1. Customer has placed and paid for an order
2. Order has been assigned to Chef

Main Flow:
1. Chef logs in and views Pending Orders list
2. Chef selects order to view details
3. Chef updates status to "In Preparation"
4. Chef prepares dishes
5. Chef marks order as "Ready for Delivery"
6. System notifies Manager and DeliveryPeople

Alternate Flows:
A1: Ingredient Shortage
  - Chef marks order as "On Hold"
  - Sends shortage notification to Manager

A3: Complaints/Ratings
  - Chef with avg rating < 2 stars OR 3 net complaints → Demoted
  - Second demotion → Terminated
  - Chef with avg rating > 4 stars OR 3 net compliments → Bonus
"""

# Orders for chefs to prepare
def get_orders_for_preparation():
    orders = Order.objects(status="Queued_For_Preparation").order_by("created_at")

    return [
        {
            "order_id": str(order.id),
            "customer_name": order.customer.name,
            "customer_id": str(order.customer.id),
            "items": [
                {
                    "dish": item.dish.name,
                    "quantity": item.quantity,

                } for item in order.items
            ],
            "status": order.status,
            "created_at": order.created_at
        }
        for order in orders
    ]

# Get detailed order information for Chef
def get_order_details(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404
    
    return {
        "order_id": str(order.id),
        "customer_name": order.customer.name,
        "customer_id": str(order.customer.id),
        "customer_notes": order.notes,
        "items": [
            {
                "dish_name": item.dish.name,
                "quantity": item.quantity,
                "instructions": item.dish.description or ""
            } for item in order.items
        ],
        "status": order.status,
        "created_at": order.created_at
    }, 200

# Start preparing an order (UC-02: Step 3)
def start_preparation(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404

    if order.status != "Queued_For_Preparation":
        return {"error": "Order is not ready for preparation."}, 400

    order.set_status("In_Preparation")
    return {"message": "Order is now in preparation.", "order_id": str(order.id)}, 200

# Complete preparing an order (UC-02: Step 5)
def complete_preparation(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404

    if order.status != "In_Preparation":
        return {"error": "Order is not in preparation."}, 400

    order.set_status("Ready_For_Delivery")
    return {"message": "Order is ready for delivery.", "order_id": str(order.id)}, 200

# Put an order on hold due to ingredient shortage (UC-02: A1)
def set_order_on_hold(order_id, note):
    order = Order.objects(id=order_id).first()

    if not order:
        return {"error": "Order not found."}, 404

    if order.status not in ["Queued_For_Preparation", "In_Preparation"]:
        return {"error": "Order cannot be put on hold in its current status."}, 400

    order.set_status("On_Hold")
    order.add_note(note)
    
    return {
        "message": "Order has been put on hold due to ingredient shortage.",
        "order_id": str(order.id),
        "note": note
    }, 200

# Get Chef's in-progress orders
def get_chef_orders(chef_id):
    """Get all orders assigned to this chef (In_Preparation, Ready_For_Delivery, On_Hold)"""
    orders = Order.objects(status__in=["In_Preparation", "Ready_For_Delivery", "On_Hold"]).order_by("-updated_at")
    
    return [
        {
            "order_id": str(order.id),
            "customer_name": order.customer.name,
            "items": [item.dish.name for item in order.items],
            "status": order.status,
            "updated_at": order.updated_at
        }
        for order in orders
    ]

# UC-02 A3: Check Chef ratings and complaints
def evaluate_chef_performance(chef_id):
    """
    Evaluate chef performance based on ratings/complaints
    - Avg rating < 2 stars OR 3 net complaints → Demote
    - Avg rating > 4 stars OR 3 net compliments → Bonus
    """
    chef = User.objects(id=chef_id).first()
    if not chef or chef.role not in ["Chef", "Demoted_Chef"]:
        return {"error": "Invalid chef."}, 400
    
    # Get all complaints about this chef
    complaints = Complaint.objects(toUser=chef_id, status="Valid")
    compliments = Complaint.objects(toUser=chef_id, status="Valid", isComplaint=False)
    
    complaint_count = len(complaints)
    compliment_count = len(compliments)
    net_complaints = complaint_count - compliment_count
    
    # Calculate average rating from complaints
    ratings = [c.rating for c in complaints if c.rating > 0]
    avg_rating = sum(ratings) / len(ratings) if ratings else 5.0
    
    result = {
        "chef_id": str(chef_id),
        "complaint_count": complaint_count,
        "compliment_count": compliment_count,
        "net_complaints": net_complaints,
        "avg_rating": round(avg_rating, 2),
        "action": "none"
    }
    
    # Demotion logic (UC-02 A3)
    if (avg_rating < 2.0 or net_complaints >= 3) and chef.role == "Chef":
        if chef.demotionsCount == 0:
            chef.role = "Demoted_Chef"
            chef.demotionsCount += 1
            chef.save()
            result["action"] = "demoted"
            result["message"] = "Chef has been demoted due to poor performance (low ratings or multiple complaints)"
        elif chef.demotionsCount >= 1:
            chef.status = "Terminated"
            chef.save()
            result["action"] = "terminated"
            result["message"] = "Chef has been terminated after repeated poor performance"
    
    # Bonus logic (UC-02 A3)
    if avg_rating > 4.0 or compliment_count >= 3:
        if chef.status == "Active":
            result["action"] = "bonus"
            result["message"] = "Chef is eligible for performance bonus!"
    
    return result, 200
