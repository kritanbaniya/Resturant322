from models.delivery import Delivery, DeliveryBid
from models.order import Order
from models.user import User

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

def update_delivery_status(delivery_person_id, delivery_id, new_status, note=None):
    delivery = Delivery.objects(id=delivery_id).first()
    if not delivery:
        return {"error": "Delivery not found"}, 404
    
    if str(delivery.deliveryPerson.id) != str(delivery_person_id):
        return {"error": "Unauthorized: Not the assigned delivery person"}, 403
    
    order = delivery.order

    if new_status == "Out_For_Delivery":
        delivery.set_status("Out_For_Delivery")
        order.set_status("Out_For_Delivery")
        return {"message": "Delivery status updated to Out_For_Delivery"}, 200
    
    if new_status == "Delivered":
        delivery.set_status("Delivered")
        order.set_status("Completed")
        return {"message": "Delivery status updated to Delivered"}, 200
    
    if new_status == "Delivery_Failed":
        delivery.set_status("Delivery_Failed", note=note)
        order.set_status("Delivery_Failed")
        return {
            "message": "Delivery status updated to Delivery_Failed",
            "note": note
            }, 200
    return {"error": "Invalid status update"}, 400
