from flask import Blueprint, request, jsonify
from services.delivery_service import submit_bid, assign_delivery, update_delivery_status

delivery_bp = Blueprint("delivery", __name__)

@delivery_bp.post("/bid")
def bid():
    data = request.get_json()
    delivery_person_id = data.get("delivery_person_id")
    order_id = data.get("order_id")
    amount = data.get("amount")

    if not delivery_person_id or not order_id or amount is None:
        return jsonify({"error": "delivery_person_id, order_id, and amount are required."}), 400

    response, status = submit_bid(delivery_person_id, order_id, amount)
    return jsonify(response), status

@delivery_bp.post("/assign")
def assign():
    data = request.get_json()

    manager_id = data.get("manager_id")
    bid_id = data.get("bid_id")
    justification = data.get("justification")

    if not manager_id or not bid_id:
        return jsonify({"error": "manager_id and bid_id are required."}), 400
    
    response, status = assign_delivery(manager_id, bid_id, justification)
    return jsonify(response), status

@delivery_bp.post("/update-status/<delivery_id>")
def update_status(delivery_id):
    data = request.get_json()

    delivery_person_id = data.get("delivery_person_id")
    new_status = data.get("status")
    note = data.get("note")

    if not delivery_person_id or not new_status:
        return jsonify({"error": "delivery_person_id and status are required."}), 400
    
    response, status = update_delivery_status(delivery_person_id, delivery_id, new_status, note)
    return jsonify(response), status