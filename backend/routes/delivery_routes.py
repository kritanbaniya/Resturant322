from flask import Blueprint, request, jsonify
from bson import ObjectId
from services.delivery_service import (
    submit_bid,
    assign_delivery,
    get_assigned_deliveries,
    get_delivery_details,
    confirm_pickup,
    update_delivery_status,
    evaluate_delivery_performance,
    get_delivery_history
)
from utils.auth import token_required

delivery_bp = Blueprint("delivery", __name__)

# UC-03 Step 1: Get assigned deliveries for delivery person
@delivery_bp.route('/assignments/<delivery_person_id>', methods=['GET'])
@token_required
def get_assignments(current_user, delivery_person_id):
    if current_user['role'] not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    if str(current_user['id']) != str(delivery_person_id):
        return jsonify({"error": "Cannot view other delivery person's assignments"}), 403
    
    deliveries = get_assigned_deliveries(delivery_person_id)
    return jsonify({
        "deliveries": deliveries,
        "total": len(deliveries)
    }), 200

# UC-03 Steps 2-4: Get delivery details for tracking
@delivery_bp.route('/<delivery_id>', methods=['GET'])
@token_required
def get_details(current_user, delivery_id):
    if current_user['role'] not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(delivery_id):
        return jsonify({"error": "Invalid delivery ID"}), 400
    
    result, status_code = get_delivery_details(current_user['id'], delivery_id)
    return jsonify(result), status_code

# UC-03 Step 2: Confirm pickup from restaurant
@delivery_bp.route('/pickup/<delivery_id>', methods=['POST'])
@token_required
def confirm_pickup_endpoint(current_user, delivery_id):
    if current_user['role'] not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(delivery_id):
        return jsonify({"error": "Invalid delivery ID"}), 400
    
    result, status_code = confirm_pickup(current_user['id'], delivery_id)
    return jsonify(result), status_code

# UC-03 Step 6: Confirm delivery to customer
@delivery_bp.route('/confirm/<delivery_id>', methods=['POST'])
@token_required
def confirm_delivery(current_user, delivery_id):
    if current_user['role'] not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(delivery_id):
        return jsonify({"error": "Invalid delivery ID"}), 400
    
    result, status_code = update_delivery_status(current_user['id'], delivery_id, "Delivered")
    return jsonify(result), status_code

# UC-03 A1: Mark delivery as failed
@delivery_bp.route('/failed/<delivery_id>', methods=['POST'])
@token_required
def mark_failed(current_user, delivery_id):
    if current_user['role'] not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(delivery_id):
        return jsonify({"error": "Invalid delivery ID"}), 400
    
    data = request.get_json()
    reason = data.get('reason', 'No reason provided')
    
    result, status_code = update_delivery_status(current_user['id'], delivery_id, "Delivery_Failed", reason)
    return jsonify(result), status_code

# UC-03 A3: Get performance evaluation
@delivery_bp.route('/performance/<delivery_person_id>', methods=['GET'])
@token_required
def get_performance(current_user, delivery_person_id):
    if current_user['role'] != "Manager" and str(current_user['id']) != str(delivery_person_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(delivery_person_id):
        return jsonify({"error": "Invalid delivery person ID"}), 400
    
    result, status_code = evaluate_delivery_performance(delivery_person_id)
    return jsonify(result), status_code

# Get delivery history
@delivery_bp.route('/history/<delivery_person_id>', methods=['GET'])
@token_required
def get_history(current_user, delivery_person_id):
    if current_user['role'] not in ["DeliveryPerson", "Demoted_DeliveryPerson"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    if str(current_user['id']) != str(delivery_person_id):
        return jsonify({"error": "Cannot view other delivery person's history"}), 403
    
    if not ObjectId.is_valid(delivery_person_id):
        return jsonify({"error": "Invalid delivery person ID"}), 400
    
    limit = request.args.get('limit', 20, type=int)
    deliveries = get_delivery_history(delivery_person_id, limit)
    return jsonify({
        "deliveries": deliveries,
        "total": len(deliveries)
    }), 200

# Delivery person: Submit bid for delivery
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

# Manager: Assign delivery from bids
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

# Update delivery status (legacy endpoint)
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