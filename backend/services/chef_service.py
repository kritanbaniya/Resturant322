from models.order import Order

def get_orders_for_preparation():
    orders = Order.objects(status="Queued_For_Preparation").order_by("created_at")

    return [
        {
            "order_id": str(order.id),
            "customer": str(order.customer.id),
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

def start_preparation(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404

    if order.status != "Queued_For_Preparation":
        return {"error": "Order is not ready for preparation."}, 400

    order.set_status("In_Preparation")
    return {"message": "Order is now in preparation.", "order_id": str(order.id)}, 200

def complete_preparation(order_id):
    order = Order.objects(id=order_id).first()
    if not order:
        return {"error": "Order not found."}, 404

    if order.status != "In_Preparation":
        return {"error": "Order is not in preparation."}, 400

    order.set_status("Ready_For_Delivery")
    return {"message": "Order is ready for delivery.", "order_id": str(order.id)}, 200

def set_order_on_hold(order_id, note): # Alternative flow
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