from models.delivery import Delivery, DeliveryBid
from models.order import Order
from models.user import User
from models.complaint import Complaint

"""
UC-03: Deliver Food
Actor: Delivery Person
Preconditions:
1. Delivery Person assigned to order
2. Order status is "Ready for Delivery"

Main Flow:
1. Delivery Person logs in and views assigned deliveries
2. Confirms pickup from restaurant (status: "Out for Delivery")
3. System updates order tracking for customer
4. Delivery Person delivers food to customer
5. Customer confirms receipt via system
6. Delivery Person marks order as "Delivered"
7. System completes order, releases payment, prompts for feedback

Alternate Flows:
A1: Delivery Failure
  - Marks "Delivery Failed" with note
  - System alerts Manager

A3: Complaints/Ratings
  - Low ratings (< 2 stars) OR 3 net complaints → Demote
  - Second demotion → Terminate
  - High ratings (> 4 stars) OR 3 net compliments → Bonus
"""

# Delivery person submits a bid for an order
def submit_bid(delivery_person_id, order_id, bid_amount):
    delivery_person = User.objects(id=delivery_person_id).first()
    if not delivery_person or delivery_person.role != "DeliveryPerson":
        return {"error": "Delivery person not found"}, 403
    
    order = Order.objects(id=order_id).first()
    if not order or order.status != "Ready_For_Delivery":
        return {"error": "Order not available for delivery bidding"}, 400

    bid = DeliveryBid(
        deliveryPerson=delivery_person,
        order=order,
        amount=bid_amount,
        status="Pending"
    ).save()

    return {"message": "Bid submitted successfully", "bid_id": str(bid.id)}, 201

# Manager assigns a delivery person based on bids and justification if needed
def assign_delivery(manager_id, bid_id, justification=None):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized: Manager not found"}, 403
    
    bid = DeliveryBid.objects(id=bid_id).first()
    if not bid:
       return {"error": "Bid not found"}, 404
    
    lowest_bid = DeliveryBid.objects(order=bid.order).order_by("amount").first()
    if bid.amount > lowest_bid.amount and not justification:
        return {"error": "Justification required for accepting a higher bid"}, 400
    
    for other in DeliveryBid.objects(order=bid.order, status="Pending"):
        if str(other.id) != str(bid.id):
            other.status = "Rejected"
            other.save()
    bid.status = "Accepted"
    bid.save()
    
    delivery = Delivery(
       order=bid.order,
       deliveryPerson=bid.deliveryPerson,
       bidAmount=bid.amount,
       status="Assigned"
   ).save()
    
    bid.order.set_status("Awaiting_Pickup")
    
    return {
         "message": "Delivery assigned successfully",
         "delivery_id": str(delivery.id)
   }, 200

# Get assigned deliveries for delivery person (UC-03 Step 1)
def get_assigned_deliveries(delivery_person_id):
    """Get all assigned deliveries for this delivery person"""
    deliveries = Delivery.objects(deliveryPerson=delivery_person_id, status__in=["Assigned", "Out_For_Delivery"]).order_by("-created_at")
    
    return [
        {
            "delivery_id": str(d.id),
            "order_id": str(d.order.id),
            "customer_name": d.order.customer.name,
            "customer_phone": d.order.customer.phone or "N/A",
            "customer_address": d.order.customer.address or "N/A",
            "items": [item.dish.name for item in d.order.items],
            "bid_amount": d.bidAmount,
            "status": d.status,
            "created_at": d.created_at
        }
        for d in deliveries
    ]

# Get delivery details (UC-03 Step 2-4)
def get_delivery_details(delivery_person_id, delivery_id):
    """Get detailed delivery information"""
    delivery = Delivery.objects(id=delivery_id).first()
    if not delivery:
        return {"error": "Delivery not found"}, 404
    
    if str(delivery.deliveryPerson.id) != str(delivery_person_id):
        return {"error": "Unauthorized: Not your delivery"}, 403
    
    order = delivery.order
    
    return {
        "delivery_id": str(delivery.id),
        "order_id": str(order.id),
        "customer_name": order.customer.name,
        "customer_phone": order.customer.phone or "N/A",
        "customer_address": order.customer.address or "N/A",
        "customer_notes": order.notes or "",
        "items": [
            {
                "dish_name": item.dish.name,
                "quantity": item.quantity,
                "price": item.price
            }
            for item in order.items
        ],
        "final_price": order.final_price,
        "bid_amount": delivery.bidAmount,
        "status": delivery.status,
        "created_at": order.created_at
    }, 200

# Confirm pickup (UC-03 Step 2)
def confirm_pickup(delivery_person_id, delivery_id):
    """Mark order as out for delivery (UC-03 Step 2)"""
    delivery = Delivery.objects(id=delivery_id).first()
    if not delivery:
        return {"error": "Delivery not found"}, 404
    
    if str(delivery.deliveryPerson.id) != str(delivery_person_id):
        return {"error": "Unauthorized"}, 403
    
    if delivery.status != "Assigned":
        return {"error": "Delivery not assigned or already started"}, 400
    
    delivery.set_status("Out_For_Delivery")
    delivery.order.set_status("Out_For_Delivery")
    
    return {"message": "Pickup confirmed. Delivery in progress."}, 200

# Delivery person updates delivery status (UC-03 Steps 4-6)
def update_delivery_status(delivery_person_id, delivery_id, new_status, note=None):
    delivery = Delivery.objects(id=delivery_id).first()
    if not delivery:
        return {"error": "Delivery not found"}, 404
    
    if str(delivery.deliveryPerson.id) != str(delivery_person_id):
        return {"error": "Unauthorized: Not the assigned delivery person"}, 403
    
    order = delivery.order

    # UC-03 Step 6: Mark as delivered
    if new_status == "Delivered":
        delivery.set_status("Delivered")
        order.set_status("Completed")
        # Payment would be released here
        return {"message": "Order delivered successfully"}, 200
    
    # UC-03 A1: Delivery failed
    if new_status == "Delivery_Failed":
        delivery.set_status("Delivery_Failed", note=note)
        order.set_status("Delivery_Failed")
        return {
            "message": "Delivery marked as failed. Manager will be notified.",
            "note": note
        }, 200
    
    return {"error": "Invalid status update"}, 400

# UC-03 A3: Evaluate delivery person performance
def evaluate_delivery_performance(delivery_person_id):
    """
    Evaluate delivery person performance based on ratings/complaints
    - Avg rating < 2 stars OR 3 net complaints → Demote
    - Avg rating > 4 stars OR 3 net compliments → Bonus
    """
    delivery_person = User.objects(id=delivery_person_id).first()
    if not delivery_person or delivery_person.role not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return {"error": "Invalid delivery person"}, 400
    
    # Get all complaints about this delivery person
    complaints = Complaint.objects(toUser=delivery_person_id, status="Valid", isComplaint=True)
    compliments = Complaint.objects(toUser=delivery_person_id, status="Valid", isComplaint=False)
    
    complaint_count = len(complaints)
    compliment_count = len(compliments)
    net_complaints = complaint_count - compliment_count
    
    # Calculate average rating
    ratings = [c.rating for c in complaints if c.rating > 0]
    avg_rating = sum(ratings) / len(ratings) if ratings else 5.0
    
    result = {
        "delivery_person_id": str(delivery_person_id),
        "complaint_count": complaint_count,
        "compliment_count": compliment_count,
        "net_complaints": net_complaints,
        "avg_rating": round(avg_rating, 2),
        "action": "none"
    }
    
    # Demotion logic (UC-03 A3)
    if (avg_rating < 2.0 or net_complaints >= 3) and delivery_person.role == "DeliveryPerson":
        if delivery_person.demotionsCount == 0:
            delivery_person.role = "Demoted_DeliveryPerson"
            delivery_person.demotionsCount += 1
            delivery_person.save()
            result["action"] = "demoted"
            result["message"] = "Delivery person has been demoted due to poor performance"
        elif delivery_person.demotionsCount >= 1:
            delivery_person.status = "Terminated"
            delivery_person.save()
            result["action"] = "terminated"
            result["message"] = "Delivery person has been terminated"
    
    # Bonus logic (UC-03 A3)
    if avg_rating > 4.0 or compliment_count >= 3:
        if delivery_person.status == "Active":
            result["action"] = "bonus"
            result["message"] = "Delivery person is eligible for performance bonus!"
    
    return result, 200

# Get delivery history for delivery person
def get_delivery_history(delivery_person_id, limit=20):
    """Get completed deliveries for this delivery person"""
    deliveries = Delivery.objects(
        deliveryPerson=delivery_person_id,
        status__in=["Delivered", "Delivery_Failed"]
    ).order_by("-updated_at").limit(limit)
    
    return [
        {
            "delivery_id": str(d.id),
            "order_id": str(d.order.id),
            "customer_name": d.order.customer.name,
            "status": d.status,
            "bid_amount": d.bidAmount,
            "completed_at": d.updated_at
        }
        for d in deliveries
    ]

